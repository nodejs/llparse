import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { STATE_ERROR } from '../constants';
import { Node } from './base';

class ErrorNode<T extends frontend.node.Error> extends Node<T> {
  protected storeError(out: string[]): void {
    const ctx = this.compilation;

    let hexCode: string;
    if (this.ref.code < 0) {
      hexCode = `-0x` + this.ref.code.toString(16);
    } else {
      hexCode = '0x' + this.ref.code.toString(16);
    }

    out.push(`${ctx.errorField()} = ${hexCode};`);
    out.push(`${ctx.reasonField()} = ${ctx.cstring(this.ref.reason)};`);
    out.push(`${ctx.errorPosField()} = (const char*) ${ctx.posArg()};`);
  }

  public doBuild(out: string[]): void {
    this.storeError(out);

    // Non-recoverable state
    out.push(`${this.compilation.currentField()} = ` +
        `(void*) (intptr_t) ${STATE_ERROR};`);
    out.push(`return ${STATE_ERROR};`);
  }
}

export { ErrorNode as Error };
