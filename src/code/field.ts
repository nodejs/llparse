import { Compilation, IRBasicBlock, IRDeclaration } from '../compilation';
import { CCONV, FN_ATTR_CODE, LINKAGE } from '../constants';
import { Code, Signature } from './base';

export abstract class Field extends Code {
  constructor(signature: Signature, cacheKey: string, name: string,
              private readonly field: string) {
    super(signature, cacheKey, name);
  }

  public build(ctx: Compilation): IRDeclaration {
    if (this.cachedDecl !== undefined) {
      return this.cachedDecl;
    }

    const sig = this.getSignature(ctx);
    const fn = ctx.defineFunction(sig, this.name, this.getParams());
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
