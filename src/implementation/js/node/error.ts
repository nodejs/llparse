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
    out.push(`${ctx.reasonField()} = ${JSON.stringify(this.ref.reason)};`);
    out.push(`${ctx.errorOffField()} = ${ctx.offArg()};`);
  }

  public doBuild(out: string[]): void {
    this.storeError(out);

    // Non-recoverable state
    out.push(`${this.compilation.currentField()} = ${STATE_ERROR};`);
    out.push(`return ${STATE_ERROR};`);
  }
}

export { ErrorNode as Error };
