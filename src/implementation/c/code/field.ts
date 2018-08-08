import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Code } from './base';

export abstract class Field<T extends frontend.code.Field> extends Code<T> {
  public build(ctx: Compilation, out: string[]): void {
    this.doBuild(ctx, out);
  }

  protected abstract doBuild(ctx: Compilation, out: string[]): void;
}
