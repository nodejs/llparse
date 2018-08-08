import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';

export abstract class Code<T extends frontend.code.Code> {
  protected cachedDecl: string | undefined;

  constructor(public readonly ref: T) {
  }

  public abstract build(ctx: Compilation, out: string[]): void;
}
