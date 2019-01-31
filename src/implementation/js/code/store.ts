import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export class Store extends Field<frontend.code.Store> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    let value = ctx.matchVar();
    if (ctx.getFieldType(this.ref.field) === 'i64') {
      value = `BigInt(${value})`;
    }
    out.push(`${this.field(ctx)} = ${value};`);
    out.push('return 0;');
  }
}
