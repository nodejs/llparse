import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { FieldValue } from './field-value';

export class Test extends FieldValue<frontend.code.Test> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    const value = this.value(ctx);
    out.push(`return (${this.field(ctx)} & ${value}) === ${value};`);
  }
}
