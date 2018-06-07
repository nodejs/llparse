import * as frontend from 'llparse-frontend';
import * as assert from 'assert';
import { Buffer } from 'buffer';

import { IRBasicBlock } from '../compilation';
import {
  GEP_OFF,
  SEQUENCE_COMPLETE, SEQUENCE_MISMATCH, SEQUENCE_PAUSE,
  TYPE_INDEX,
} from '../constants';
import { INodePosition, Node } from './base';

export class Sequence extends Node<frontend.node.Sequence> {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    bb = this.prologue(bb, pos);

    const ctx = this.compilation;
    const seq = ctx.blob(this.ref.select);

    const cast = bb.getelementptr(seq, GEP_OFF.val(0), GEP_OFF.val(0), true);

    // TODO(indutny): implement this
    const matchSequence = this.compilation.getMatchSequence(this.ref.transform)
      .preBuild(ctx);

    const returnType = matchSequence.ty.toSignature().returnType.toStruct();

    const call = bb.call(matchSequence, [
      ctx.stateArg(bb),
      pos.current,
      ctx.endPosArg(bb),
      cast,
      TYPE_INDEX.val(this.ref.select.length),
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
        this.ref.otherwise!.node.ref instanceof frontend.node.Error ?
            'unlikely' : 'likely',
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
      node: this.ref.edge!.node,
      value: this.ref.edge!.value,
    }, { current, next });

    // Not enough data
    pause.name = 'pause';
    this.pause(pause);

    // Not equal
    mismatch.name = 'mismatch';
    this.tailTo(mismatch, this.ref.otherwise!, { current, next });
  }
}
