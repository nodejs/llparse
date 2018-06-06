import * as frontend from 'llparse-frontend';

import { Compilation, IRBasicBlock, IRDeclaration } from '../compilation';
import { CCONV, FN_ATTR_CODE, LINKAGE } from '../constants';
import { Code } from './base';

export abstract class Field<T extends frontend.code.Field> extends Code<T> {
  public build(ctx: Compilation): IRDeclaration {
    if (this.cachedDecl !== undefined) {
      return this.cachedDecl;
    }

    const sig = this.getSignature(ctx);
    const fn = ctx.defineFunction(sig, this.ref.name, this.getParams());
    this.setAttributes(fn);

    this.doBuild(ctx, fn.body);
    this.cachedDecl = fn;

    return fn;
  }

  protected setAttributes(decl: IRDeclaration): void {
    super.setAttributes(decl);
    decl.attrs.add(FN_ATTR_CODE);

    decl.cconv = CCONV;
    decl.linkage = LINKAGE;
  }

  protected abstract doBuild(ctx: Compilation, bb: IRBasicBlock): void;
}
