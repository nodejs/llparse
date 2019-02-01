import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Code } from './base';

export abstract class External<T extends frontend.code.External>
  extends Code<T> {

  public build(ctx: Compilation, out: string[]): void {
    // No-op
  }
}
