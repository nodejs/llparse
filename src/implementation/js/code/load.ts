import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export class Load extends Field<frontend.code.Load> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    let value = this.field(ctx);

    // Convert BigNum to number
    if (ctx.getFieldType(this.ref.field) === 'i64') {
      value = `Number(${value})`;
    }

    out.push(`return ${value};`);
  }
}
