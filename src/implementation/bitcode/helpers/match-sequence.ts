import * as assert from 'assert';
import { Buffer } from 'buffer';
import * as frontend from 'llparse-frontend';

import {
  Compilation, IRBasicBlock, IRDeclaration, IRFunc, IRSignature, IRValue,
} from '../compilation';
import {
  ARG_ENDPOS, ARG_POS, ARG_SEQUENCE, ARG_SEQUENCE_LEN, ARG_STATE,
  ATTR_ENDPOS, ATTR_POS, ATTR_SEQUENCE, ATTR_SEQUENCE_LEN, ATTR_STATE,
  BOOL,
  CCONV,
  FN_ATTR_MATCH_SEQUENCE,
  GEP_OFF,
  LINKAGE,
  SEQUENCE_COMPLETE, SEQUENCE_MISMATCH, SEQUENCE_PAUSE,
  TYPE_ENDPOS, TYPE_POS, TYPE_SEQUENCE, TYPE_SEQUENCE_LEN, TYPE_STATUS,
} from '../constants';
import { Transform } from '../transform';

type TransformWrap = Transform<frontend.transform.Transform>;

interface IMatchIteration {
  readonly complete: IRBasicBlock;
  readonly index: IRValue;
  readonly loop: IRBasicBlock;
  readonly mismatch: IRBasicBlock;
  readonly pause: IRBasicBlock;
  readonly pos: {
    readonly current: IRValue;
    readonly next: IRValue;
  };
}

export class MatchSequence {
  private maxSequenceLen: number = 0;
  private cachedFn: IRFunc | undefined;

  constructor(private readonly transform: TransformWrap) {
  }

  public addSequence(sequence: Buffer): void {
    this.maxSequenceLen = Math.max(this.maxSequenceLen, sequence.length);
  }

  public preBuild(ctx: Compilation): IRDeclaration {
    if (this.cachedFn !== undefined) {
      return this.cachedFn;
    }

    const returnType = ctx.ir.struct();
    returnType.addField(TYPE_POS, 'current');
    returnType.addField(TYPE_STATUS, 'status');
    returnType.finalize();

    const signature = ctx.ir.signature(returnType, [
      ctx.state.ptr(),
      TYPE_POS,
      TYPE_ENDPOS,
      TYPE_SEQUENCE,
      TYPE_SEQUENCE_LEN,
    ]);

    const fn = ctx.defineFunction(signature,
      `${ctx.prefix}__match_sequence_${this.transform.ref.name}`,
      [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_SEQUENCE, ARG_SEQUENCE_LEN ]);

    fn.paramAttrs[0].add(ATTR_STATE);
    fn.paramAttrs[1].add(ATTR_POS);
    fn.paramAttrs[2].add(ATTR_ENDPOS);
    fn.paramAttrs[3].add(ATTR_SEQUENCE);
    fn.paramAttrs[4].add(ATTR_SEQUENCE_LEN);
    fn.attrs.add(FN_ATTR_MATCH_SEQUENCE);

    fn.linkage = LINKAGE;
    fn.cconv = CCONV;

    this.cachedFn = fn;

    return fn;
  }

  public build(ctx: Compilation): void {
    assert(this.cachedFn !== undefined);

    this.buildBody(ctx, this.cachedFn!.body);
  }

  private buildBody(ctx: Compilation, bb: IRBasicBlock): void {
    // Just to have a label
    const start = bb.parent.createBlock('start');
    bb.jmp(start);

    // Load `state.index`
    const index = start.load(ctx.indexField(start));
    index.metadata.set('invariant.group', ctx.invariantGroup);
    index.metadata.set('range', ctx.ir.metadata([
      ctx.ir.metadata(index.ty.toInt().val(0)),
      ctx.ir.metadata(index.ty.toInt().val(this.maxSequenceLen)),
    ]));

    // Loop start
    const loop = bb.parent.createBlock('loop');
    start.jmp(loop);

    const posPhi = loop.phi({ fromBlock: start, value: ctx.posArg(bb) });
    const indexPhi = loop.phi({ fromBlock: start, value: index });

    const iteration = this.buildIteration(ctx, loop, posPhi, indexPhi);

    // It is complete!
    this.ret(iteration.complete, iteration.pos.current, SEQUENCE_COMPLETE);

    // We have more data!
    iteration.loop.jmp(loop).metadata.set('llvm.loop', ctx.ir.metadata([
    ]).addSelfReference().markDistinct());
    indexPhi.addEdge({ fromBlock: iteration.loop, value: iteration.index });
    posPhi.addEdge({ fromBlock: iteration.loop, value: iteration.pos.next });

    // Have to pause - return self
    this.ret(iteration.pause, iteration.pos.current, SEQUENCE_PAUSE);

    // Not equal
    this.ret(iteration.mismatch, iteration.pos.current, SEQUENCE_MISMATCH);
  }

  private buildIteration(ctx: Compilation, bb: IRBasicBlock, pos: IRValue,
                         index: IRValue): IMatchIteration {
    const seq = bb.parent.getArgument(ARG_SEQUENCE);
    const seqLen = bb.parent.getArgument(ARG_SEQUENCE_LEN);

    let current: IRValue = bb.load(pos);

    // Transform the character
    current = this.transform.build(ctx, bb, current);

    const expected = bb.load(bb.getelementptr(seq, index));

    // NOTE: fetch this early so it would dominate all returns
    const next = bb.getelementptr(pos, GEP_OFF.val(1));

    let cmp = bb.icmp('eq', current, expected);
    const { onTrue: isMatch, onFalse: isMismatch } = ctx.branch(bb, cmp);
    isMatch.name = 'match';
    isMismatch.name = 'mismatch';

    // Mismatch
    this.reset(ctx, isMismatch);

    // Character matches
    const index1 = isMatch.binop('add', index, index.ty.val(1));
    cmp = isMatch.icmp('eq', index1, seqLen);

    const { onTrue: isComplete, onFalse: isIncomplete } =
      ctx.branch(isMatch, cmp);
    isComplete.name = 'is_complete';
    isIncomplete.name = 'is_incomplete';

    this.reset(ctx, isComplete);

    cmp = isIncomplete.icmp('ne', next, ctx.endPosArg(bb));
    const { onTrue: moreData, onFalse: noMoreData } =
      ctx.branch(isIncomplete, cmp, { onTrue: 'likely', onFalse: 'unlikely' });

    moreData.name = 'more_data';

    noMoreData.name = 'no_more_data';

    const store = noMoreData.store(index1, ctx.indexField(noMoreData));
    store.metadata.set('invariant.group', ctx.invariantGroup);

    return {
      complete: isComplete,
      index: index1,
      loop: moreData,
      mismatch: isMismatch,
      pause: noMoreData,
      pos: { current: pos, next },
    };
  }

  private ret(bb: IRBasicBlock, pos: IRValue, status: number): void {
    const returnType = bb.parent.ty.toSignature().returnType.toStruct();

    const create = bb.insertvalue(returnType.undef(), pos,
      returnType.lookupField('current').index);

    const statusField = returnType.lookupField('status');
    const amend = bb.insertvalue(create, statusField.ty.val(status),
      statusField.index);

    bb.ret(amend);
  }

  private reset(ctx: Compilation, bb: IRBasicBlock): void {
    const ptr = ctx.indexField(bb);
    const store = bb.store(ptr.ty.toPointer().to.val(0), ptr);
    store.metadata.set('invariant.group', ctx.invariantGroup);
  }
}
