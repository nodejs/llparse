import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export class Test extends Field<frontend.code.Test> {
  protected doBuild(ctx: Compilation, out: string[]): void {
  }
}
