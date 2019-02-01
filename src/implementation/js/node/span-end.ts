import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { STATE_ERROR } from '../constants';
import { Node } from './base';

export class SpanEnd extends Node<frontend.node.SpanEnd> {
  public doBuild(out: string[]): void {
    const ctx = this.compilation;
    const field = this.ref.field;
    const offField = ctx.spanOffField(field.index);

    // Load start position
    out.push(`const start = ${offField};`);

    // ...and reset
    out.push(`${offField} = -1;`);

    // Invoke callback
    const callback = ctx.buildCode(ctx.unwrapCode(this.ref.callback));
    out.push(`const err = ${callback}.call(${ctx.stateVar()}, ` +
      `${ctx.bufArg()}, start, ${ctx.offArg()});`);

    out.push('if (err !== 0) {');
    const tmp: string[] = [];
    this.buildError(tmp, 'err');
    ctx.indent(out, tmp, '  ');
    out.push('}');

    const otherwise = this.ref.otherwise!;
    this.tailTo(out, otherwise);
  }

  private buildError(out: string[], code: string) {
    const ctx = this.compilation;

    out.push(`${ctx.errorField()} = ${code};`);

    const otherwise = this.ref.otherwise!;
    let resumeOff = ctx.offArg();
    if (!otherwise.noAdvance) {
      resumeOff = `(${resumeOff} + 1)`;
    }

    out.push(`${ctx.errorOffField()} = ${resumeOff};`);

    const resumptionTarget = ctx.unwrapNode(otherwise.node).build(ctx);
    out.push(`${ctx.currentField()} = ${resumptionTarget};`);
    out.push(`return ${STATE_ERROR};`);
  }
}
