import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { FieldValue } from './field-value';

export class Update extends FieldValue<frontend.code.Update> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    out.push(`${this.field(ctx)} = ${this.value(ctx)};`);
    out.push('return 0;');
  }
}
