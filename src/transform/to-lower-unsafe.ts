import { Compilation, IRBasicBlock, IRValue } from '../compilation';
import { Transform } from './base';

export class ToLowerUnsafe extends Transform {
  constructor() {
    super('to_lower_unsafe');
  }

  public build(ctx: Compilation, bb: IRBasicBlock, value: IRValue): IRValue {
    // TODO(indutny): implement me
    return value;
  }
}
