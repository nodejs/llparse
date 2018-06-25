import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Transform } from './base';

export class ID extends Transform<frontend.transform.ID> {
  public build(ctx: Compilation, value: string): string {
    // Identity transformation
    return value;
  }
}
