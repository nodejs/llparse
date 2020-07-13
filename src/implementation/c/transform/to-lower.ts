import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Transform } from './base';

export class ToLower extends Transform<frontend.transform.ToLower> {
  public build(ctx: Compilation, value: string): string {
    return `((${value}) >= 'A' && (${value}) <= 'Z' ? ` +
      `(${value} | 0x20) : (${value}))`;
  }
}
