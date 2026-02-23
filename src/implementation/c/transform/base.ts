import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';

export abstract class Transform<T extends frontend.transform.Transform> {
  public readonly ref: T;

  constructor(ref: T) {
    this.ref = ref;
  }

  public abstract build(ctx: Compilation, value: string): string;
}
