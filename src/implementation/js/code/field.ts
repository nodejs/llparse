import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Code } from './base';

export abstract class Field<T extends frontend.code.Field> extends Code<T> {
  public build(ctx: Compilation, out: string[]): void {
    out.push(`int ${this.ref.name}(`);
    out.push(`    ${ctx.prefix}_t* ${ctx.stateArg()},`);
    out.push(`    const unsigned char* ${ctx.posArg()},`);
    if (this.ref.signature === 'value') {
      out.push(`    const unsigned char* ${ctx.endPosArg()},`);
      out.push(`    int ${ctx.matchVar()}) {`);
    } else {
      out.push(`    const unsigned char* ${ctx.endPosArg()}) {`);
    }
    const tmp: string[] = [];
    this.doBuild(ctx, tmp);
    ctx.indent(out, tmp, '  ');
    out.push('}');
  }

  protected abstract doBuild(ctx: Compilation, out: string[]): void;

  protected field(ctx: Compilation): string {
    return `${ctx.stateArg()}->${this.ref.field}`;
  }
}
