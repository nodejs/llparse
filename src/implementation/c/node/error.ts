import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { STATE_NULL } from '../constants';
import { Node } from './base';

class ErrorNode<T extends frontend.node.Error> extends Node<T> {
  protected storeError(out: string[]): void {
    const ctx = this.compilation;

    out.push(`${ctx.errorField()} = ${this.ref.code};`);
    out.push(`${ctx.reasonField()} = ${ctx.cstring(this.ref.reason)};`);
    out.push(`${ctx.errorPosField()} = ${ctx.posArg()};`);
  }

  public doBuild(out: string[]): void {
    this.storeError(out);

    // Non-recoverable state
    out.push(`${this.compilation.currentField()} = ${STATE_NULL};`);
    out.push(`return ${STATE_NULL};`);
  }
}

export { ErrorNode as Error };
