import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export class Update extends Field<frontend.code.Update> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    out.push(`${this.field(ctx)} = ${this.ref.value};`);
    out.push('return 0;');
  }
}
