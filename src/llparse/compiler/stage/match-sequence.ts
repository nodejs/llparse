import {
  CCONV,
  INT, TYPE_INPUT, TYPE_INDEX, TYPE_STATUS,
  ATTR_STATE, ATTR_POS, ATTR_ENDPOS, ATTR_SEQUENCE,

  ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_SEQUENCE, ARG_SEQUENCE_LEN,

  SEQUENCE_COMPLETE, SEQUENCE_PAUSE, SEQUENCE_MISMATCH
} from '../../constants';
import { Transform } from '../../transform';
import {
  Compilation, BasicBlock, INodePosition, Func, values,
} from '../compilation';
import { Stage } from './base';

interface IIterationResult {
  index: values.Value;
  pos: INodePosition;
  complete: BasicBlock;
  mismatch: BasicBlock;
  loop: BasicBlock;
  pause: BasicBlock;
}

export class MatchSequence extends Stage {
  private readonly cache: Map<string, Func> = new Map();

  constructor(ctx: Compilation) {
    super(ctx, 'match-sequence');

    this.returnType = this.ctx.ir.struct('match_sequence_ret');
    this.returnType.addField(TYPE_INPUT, 'current');
    this.returnType.addField(TYPE_STATUS, 'status');
    this.returnType.finalize();

    this.signature = this.ctx.ir.signature(this.returnType, [
      this.ctx.state.ptr(),
      TYPE_INPUT,
      TYPE_INPUT,
      TYPE_INPUT,
      TYPE_INDEX
    ]);
  }

  public build(): any {
    return {
      get: transform => this.get(transform)
    };
  }

  public get(transform?: Transform): Func {
    const cacheKey = transform === undefined ? undefined : transform.name;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const postfix = cacheKey ? '_' + cacheKey.toLowerCase() : '';

    const fn = this.ctx.defineFunction(this.signature,
      `${this.ctx.prefix}__match_sequence${postfix}`,
      [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_SEQUENCE, ARG_SEQUENCE_LEN ]);

    fn.paramAttrs[0].add(ATTR_STATE);
    fn.paramAttrs[1].add(ATTR_POS);
    fn.paramAttrs[2].add(ATTR_ENDPOS);
    fn.paramAttrs[3].add(ATTR_SEQUENCE);

    this.buildBody(fn, transform);

    fn.linkage = 'internal';
    fn.cconv = CCONV;
    fn.attrs.add([ 'nounwind', 'norecurse', 'alwaysinline' ]);

    this.cache.set(cacheKey, fn);

    return fn;
  }

  private buildBody(fn: Func, transform?: Transform): void {
    const body = fn.body;

    const maxSeqLen = this.ctx.stageResults['node-translator'].maxSequenceLen;
    const range = this.ctx.ir.metadata([
      this.ctx.ir.metadata(TYPE_INDEX.val(0)),
      this.ctx.ir.metadata(TYPE_INDEX.val(maxSeqLen))
    ]);

    // Just to have a label
    const start = body.parent.createBlock('start');
    body.jmp(start);

    // Load `state.index`
    const indexPtr = this.ctx.stateField(fn, start, '_index');
    const index = start.load(indexPtr);
    index.metadata.set('invariant.group', this.ctx.INVARIANT_GROUP);
    index.metadata.set('range', range);

    // Loop start
    const loop = body.parent.createBlock('loop');
    start.jmp(loop);

    const posPhi = loop.phi({ fromBlock: start, value: this.ctx.posArg(fn) });
    const indexPhi = loop.phi({ fromBlock: start, value: index });

    const iteration = this.buildIteration(fn, loop, indexPtr, posPhi, indexPhi,
      transform);

    // It is complete!
    this.ret(iteration.complete, iteration.pos, SEQUENCE_COMPLETE);

    // We have more data!
    iteration.loop.jmp(loop);
    indexPhi.addEdge({ fromBlock: iteration.loop, value: iteration.index });
    posPhi.addEdge({ fromBlock: iteration.loop, value: iteration.pos.next });

    // Have to pause - return self
    this.ret(iteration.pause, iteration.pos, SEQUENCE_PAUSE);

    // Not equal
    this.ret(iteration.mismatch, iteration.pos, SEQUENCE_MISMATCH);
  }

  private buildIteration(fn: Func, body: BasicBlock, indexField: values.Value,
                         pos: values.Value, index: values.Value,
                         transform?: Transform): IIterationResult {
    const seq = fn.getArgument(ARG_SEQUENCE);
    const seqLen = fn.getArgument(ARG_SEQUENCE_LEN);

    let current = body.load(pos);

    // Transform the character if needed
    if (transform) {
      const res  = this.ctx.buildTransform(transform,
        body, current);
      body = res.body;
      current = res.current;
    }

    const expectedPtr = body.getelementptr(seq, index);
    const expected = body.load(expectedPtr);

    // NOTE: fetch this early so it would dominate all returns
    const next = body.getelementptr(pos, INT.val(1));

    let cmp = body.icmp('eq', current, expected);
    const isMatch = fn.createBlock('match');
    const isMismatch = fn.createBlock('mismatch');
    body.branch(cmp, isMatch, isMismatch);

    // Mismatch
    this.reset(isMismatch, indexField);

    // Character matches
    const index1 = isMatch.binop('add', index, TYPE_INDEX.val(1));
    cmp = isMatch.icmp('eq', index1, seqLen);

    const isComplete = fn.createBlock('is_complete');
    const isIncomplete = fn.createBlock('is_incomplete');
    isMatch.branch(cmp, isComplete, isIncomplete);

    this.reset(isComplete, indexField);

    cmp = isIncomplete.icmp('ne', next, this.ctx.endPosArg(fn));
    const { left: moreData, right: noMoreData } =
      this.ctx.branch(isIncomplete, cmp, [ 'likely', 'unlikely' ]);

    moreData.name = 'more_data';

    noMoreData.name = 'no_more_data';
    const store = noMoreData.store(index1, indexField);
    store.metadata.set('invariant.group', this.ctx.INVARIANT_GROUP);

    return {
      index: index1,
      pos: { current: pos, next },
      complete: isComplete,
      mismatch: isMismatch,
      loop: moreData,
      pause: noMoreData
    };
  }

  private ret(body: BasicBlock, pos: INodePosition, status: number): void {
    const create = body.insertvalue(this.returnType.undef(), pos.current,
      this.returnType.lookupField('current').index);

    const amend = body.insertvalue(create, TYPE_STATUS.val(status),
      this.returnType.lookupField('status').index);

    body.ret(amend);
  }

  private reset(body: BasicBlock, field: values.Value): void {
    const store = body.store(TYPE_INDEX.val(0), field);
    store.metadata.set('invariant.group', this.ctx.INVARIANT_GROUP);
  }
}
