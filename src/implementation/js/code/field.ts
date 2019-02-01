import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Code } from './base';

export abstract class Field<T extends frontend.code.Field> extends Code<T> {
  public build(ctx: Compilation, out: string[]): void {
    out.push(`function ${this.ref.name}(${ctx.bufArg()},`);
    if (this.ref.signature === 'value') {
      out.push(`    ${ctx.offArg()},`);
      out.push(`    ${ctx.matchVar()}) {`);
    } else {
      out.push(`    ${ctx.offArg()}) {`);
    }
    const tmp: string[] = [];
    this.doBuild(ctx, tmp);
    ctx.indent(out, tmp, '  ');
    out.push('}');
  }

  protected abstract doBuild(ctx: Compilation, out: string[]): void;

  protected field(ctx: Compilation): string {
    return ctx.stateField(this.ref.field);
  }
}
