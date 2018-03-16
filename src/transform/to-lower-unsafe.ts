import { Compilation, IRBasicBlock } from '../compilation';
import { Transform } from './base';

export class ToLowerUnsafe extends Transform {
  constructor() {
    super('to_lower_unsafe');
  }

  public build(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
