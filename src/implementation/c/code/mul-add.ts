import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export class MulAdd extends Field<frontend.code.MulAdd> {
  protected doBuild(ctx: Compilation, out: string[]): void {
  }
}
