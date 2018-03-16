import { Compilation, IRBasicBlock, IRDeclaration } from '../compilation';
import { FN_ATTR_CODE } from '../constants';
import { Code, Signature } from './base';

export abstract class Field extends Code {
  constructor(signature: Signature, name: string,
              private readonly field: string) {
    super(signature, name);
  }

  public build(ctx: Compilation): IRDeclaration {
    const cache = ctx.codeCache;
    if (cache.has(this)) {
      return cache.get(this)!;
    }

    const sig = this.getSignature(ctx);
    const fn = ctx.defineFunction(sig, this.name, this.getParams());
    this.setAttributes(fn);

    this.doBuild(ctx, fn.body);
    cache.set(this, fn);

    return fn;
  }

  protected setAttributes(decl: IRDeclaration): void {
    super.setAttributes(decl);
    decl.attrs.add(FN_ATTR_CODE);
  }

  protected abstract doBuild(ctx: Compilation, bb: IRBasicBlock): void;
}
