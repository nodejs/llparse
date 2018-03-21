import { Span as SpanCallback } from '../code';
import { IRBasicBlock } from '../compilation';
import { Span } from '../span';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';

export class SpanStart extends Node {
  constructor(id: IUniqueName, private readonly span: Span,
              private readonly callback: SpanCallback) {
    super(id);
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    // Prevent spurious empty spans
    bb = this.prologue(bb, pos);

    const ctx = this.compilation;
    const span = this.span;

    bb.store(ctx.posArg(bb), ctx.spanPosField(bb, span.index));

    if (span.callbacks.length > 1) {
      bb.store(this.callback.build(ctx), ctx.spanCbField(bb, span.index));
    }

    this.tailTo(bb, this.otherwise!, pos);
  }
}
