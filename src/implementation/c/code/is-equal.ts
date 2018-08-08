import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export class IsEqual extends Field<frontend.code.IsEqual> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    out.push(`return ${this.field(ctx)} == ${this.ref.value};`);
  }
}
