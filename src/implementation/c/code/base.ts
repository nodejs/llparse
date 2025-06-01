import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';

export abstract class Code<T extends frontend.code.Code> {
  protected cachedDecl: string | undefined;
  public readonly ref: T;

  constructor(ref: T) {
    this.ref = ref;
  }

  public abstract build(ctx: Compilation, out: string[]): void;
}
