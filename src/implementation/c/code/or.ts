import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export class Or extends Field<frontend.code.Or> {
  protected doBuild(ctx: Compilation, out: string[]): void {
  }
}
