import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export class Load extends Field<frontend.code.Load> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    out.push(`return ${this.field(ctx)};`);
  }
}
