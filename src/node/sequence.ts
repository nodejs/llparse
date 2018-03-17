import * as assert from 'assert';
import { Buffer } from 'buffer';

import { IRBasicBlock } from '../compilation';
import {
  GEP_OFF,
  SEQUENCE_COMPLETE, SEQUENCE_MISMATCH, SEQUENCE_PAUSE,
  TYPE_INDEX,
} from '../constants';
import { MatchSequence } from '../match-sequence';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';
import { Error as ErrorNode } from './error';
import { Match } from './match';

export interface ISequenceEdge {
  readonly node: Node;
  readonly value: number | undefined;
}

export class Sequence extends Match {
  private edge: ISequenceEdge | undefined;

  constructor(id: IUniqueName, private readonly matchSequence: MatchSequence,
              private readonly select: Buffer) {
    super(id);
  }

  public setEdge(node: Node, value: number | undefined) {
    assert.strictEqual(this.edge, undefined);
    this.edge = { node, value };
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    bb = this.prologue(bb, pos);

    const ctx = this.compilation;
    const seq = ctx.blob(this.select);

    const cast = bb.getelementptr(seq, GEP_OFF.val(0), GEP_OFF.val(0), true);

    const matchSequence = this.matchSequence.build(ctx);

    const returnType = matchSequence.ty.toSignature().returnType.toStruct();

    const call = bb.call(matchSequence, [
      ctx.stateArg(bb),
      pos.current,
      ctx.endPosArg(bb),
      cast,
      TYPE_INDEX.val(this.select.length),
    ]);

    const status = bb.extractvalue(call,
      returnType.lookupField('status').index);
    const current = bb.extractvalue(call,
      returnType.lookupField('current').index);

    // This is lame, but it is easier to do it this way
    // (Optimizer will remove it, if it isn't needed)
    const next = bb.getelementptr(current, GEP_OFF.val(1));

    const s = ctx.switch(bb, status, [
      SEQUENCE_PAUSE,
      SEQUENCE_MISMATCH,
    ], {
      cases: [
        // SEQUENCE_PAUSE
        'unlikely',

        // SEQUENCE_MISMATCH
        this.otherwise!.node instanceof ErrorNode ? 'unlikely' : 'likely',
      ],
      otherwise: 'likely',  // SEQUENCE_COMPLETE
    });

    const complete = s.otherwise;
    const pause = s.cases[0];
    const mismatch = s.cases[1];

    // Matched full sequence
    complete.name = 'complete';
    this.tailTo(complete, {
      noAdvance: false,
      node: this.edge!.node,
      value: this.edge!.value,
    }, { current, next });

    // Not enough data
    pause.name = 'pause';
    this.pause(pause);

    // Not equal
    mismatch.name = 'mismatch';
    this.tailTo(mismatch, this.otherwise!, { current, next });
  }
}
