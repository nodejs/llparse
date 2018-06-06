import * as frontend from 'llparse-frontend';

import { Compilation, IRBasicBlock, IRValue } from '../compilation';
import { Transform } from './base';

export class ToLowerUnsafe extends Transform<frontend.transform.ToLowerUnsafe> {
  public build(ctx: Compilation, bb: IRBasicBlock, value: IRValue): IRValue {
    return bb.binop('or', value, value.ty.val(0x20));
  }
}
