import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { External } from './external';

export class Span<T extends frontend.code.Span> extends External<T> {
  protected getArgs(ctx: Compilation): ReadonlyArray<string> {
    return [ ctx.bufArg(), ctx.offArg(), 'offEnd' ];
  }
}
