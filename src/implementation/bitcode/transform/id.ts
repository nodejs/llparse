import * as frontend from 'llparse-frontend';

import { Compilation, IRBasicBlock, IRValue } from '../compilation';
import { Transform } from './base';

export class ID extends Transform<frontend.transform.ID> {
  public build(ctx: Compilation, bb: IRBasicBlock, value: IRValue): IRValue {
    // Identity transformation
    return value;
  }
}
