import { Compilation, IRBasicBlock, IRValue } from '../compilation';
import { Transform } from './base';

export class ID extends Transform {
  constructor() {
    super('id');
  }

  public build(ctx: Compilation, bb: IRBasicBlock, value: IRValue): IRValue {
    // Identity transformation
    return value;
  }
}
