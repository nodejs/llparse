import { Compilation, IRBasicBlock, IRValue } from '../compilation';

export abstract class Transform {
  constructor(public readonly name: string) {
  }

  public abstract build(ctx: Compilation, bb: IRBasicBlock, value: IRValue)
    : IRValue;
}
