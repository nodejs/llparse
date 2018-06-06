import * as frontend from 'llparse-frontend';

import { Compilation, IRBasicBlock, IRValue } from '../compilation';

export abstract class Transform<T extends frontend.transform.Transform> {
  constructor(public readonly ref: T) {
  }

  public abstract build(ctx: Compilation, bb: IRBasicBlock, value: IRValue)
    : IRValue;
}
