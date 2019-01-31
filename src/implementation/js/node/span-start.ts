import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

export class SpanStart extends Node<frontend.node.SpanStart> {
  public doBuild(out: string[]): void {
    // Prevent spurious empty spans
    this.prologue(out);

    const ctx = this.compilation;
    const field = this.ref.field;

    const posField = ctx.spanPosField(field.index);
    out.push(`${posField} = (void*) ${ctx.posArg()};`);

    if (field.callbacks.length > 1) {
      const cbField = ctx.spanCbField(field.index);
      const callback = ctx.unwrapCode(this.ref.callback);
      out.push(`${cbField} = ${ctx.buildCode(callback)};`);
    }

    const otherwise = this.ref.otherwise!;
    this.tailTo(out, otherwise);
  }
}
