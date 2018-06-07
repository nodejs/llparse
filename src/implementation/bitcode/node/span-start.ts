import * as frontend from 'llparse-frontend';

import { Code } from '../code';
import { IRBasicBlock } from '../compilation';
import { CONTAINER_KEY } from '../constants';
import { INodePosition, Node } from './base';

export class SpanStart extends Node<frontend.node.SpanStart> {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    // Prevent spurious empty spans
    bb = this.prologue(bb, pos);

    const ctx = this.compilation;
    const field = this.ref.field;

    bb.store(ctx.posArg(bb), ctx.spanPosField(bb, field.index));

    if (field.callbacks.length > 1) {
      const callback = ctx.unwrapCode(this.ref.callback);
      bb.store(callback.build(ctx), ctx.spanCbField(bb, field.index));
    }

    this.tailTo(bb, this.ref.otherwise!, pos);
  }
}
