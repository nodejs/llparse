import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import { Compilation, IRBasicBlock } from '../compilation';
import { INTPTR } from '../constants';
import { INodePosition, Node } from './base';

export class Consume extends Node<frontend.node.Consume> {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const ctx = this.compilation;
    const invariantGroup = ctx.invariantGroup;

    // index = state[field]
    const indexPtr = ctx.stateField(bb, this.ref.field);
    const index = bb.load(indexPtr);
    index.metadata.set('invariant.group', invariantGroup);

    // need = (intptr_t) index
    const need = ctx.truncate(bb, index, INTPTR);

    const intPos = bb.cast('ptrtoint', pos.current, INTPTR);
    const intEndPos = bb.cast('ptrtoint', ctx.endPosArg(bb), INTPTR);

    // avail = endPos - pos
    const avail = bb.binop('sub', intEndPos, intPos);

    // if (avail >= need)
    const cmp = bb.icmp('uge', avail, need);
    const { onTrue: hasData, onFalse: noData } = ctx.branch(bb, cmp, {
      onFalse: 'unlikely',
      onTrue: 'likely',
    });

    hasData.name = 'has_data';
    noData.name = 'no_data';

    // Continue!
    const next = hasData.getelementptr(pos.current, index);

    assert(this.ref.otherwise!.noAdvance);

    // state[field] = 0
    hasData.store(index.ty.val(0), indexPtr)
      .metadata.set('invariant.group', invariantGroup);
    this.tailTo(hasData, this.ref.otherwise!, { current: next, next });

    // Pause!
    // state[field] = need - avail
    const left = noData.binop('sub', need, avail);
    const leftTrunc = ctx.truncate(noData, left, index.ty);

    noData.store(leftTrunc, indexPtr)
      .metadata.set('invariant.group', invariantGroup);
    this.pause(noData);
  }
}
