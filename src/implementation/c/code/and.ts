import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export class And extends Field<frontend.code.And> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    out.push(`${this.field(ctx)} &= ${this.ref.value};`);
    out.push('return 0;');
  }
}
