import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export class Store extends Field<frontend.code.Store> {
  protected doBuild(ctx: Compilation, out: string[]): void {
  }
}
