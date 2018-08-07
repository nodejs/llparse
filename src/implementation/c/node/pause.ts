import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { STATE_ERROR } from '../constants';
import { Error as ErrorNode } from './error';

export class Pause extends ErrorNode<frontend.node.Pause> {
  public doBuild(out: string[]): void {
    const ctx = this.compilation;

    this.storeError(out);

    // Recoverable state
    const otherwise = ctx.unwrapNode(this.ref.otherwise!.node).build(ctx);
    out.push(`${ctx.currentField()} = ` +
        `(void*) (intptr_t) ${otherwise};`);
    out.push(`return ${STATE_ERROR};`);
  }
}
