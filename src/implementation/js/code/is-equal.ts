import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { FieldValue } from './field-value';

export class IsEqual extends FieldValue<frontend.code.IsEqual> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    out.push(`return ${this.field(ctx)} === ${this.value(ctx)};`);
  }
}
