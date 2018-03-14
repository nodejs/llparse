import * as assert from 'assert';

import { Signature } from '../../code';
import { Compilation, types, values } from '../compilation';

import Func = values.constants.Func;

// Just as a convenience
export { Func };

export abstract class Code {
  protected privIsExternal: boolean = false;
  protected privCacheKey: any = this;

  constructor(public readonly kind: string,
              public readonly signature: Signature,
              public readonly name: string) {
  }

  public get isExternal(): boolean { return this.privIsExternal; }
  public get cacheKey(): any { return this.privCacheKey; }

  public abstract build(): void;

  // Just for cache key generation
  protected numKey(num): string {
    if (num < 0)
      return 'm' + (-num);
    else
      return num.toString();
  }

  protected getTypes(ctx: Compilation, fn: Func, field: string) {
    const fieldType = ctx.state.lookupField(field).ty;
    const returnType = fn.ty.toSignature().returnType;
    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    assert(returnType.isInt());

    return { fieldType, returnType };
  }
}
