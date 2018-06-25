import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Transform } from './base';

export class ToLowerUnsafe extends Transform<frontend.transform.ToLowerUnsafe> {
  public build(ctx: Compilation, value: string): string {
    return `((${value}) | 0x20)`;
  }
}
