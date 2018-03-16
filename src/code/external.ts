import { Compilation, IRDeclaration, IRSignature} from '../compilation';
import { FN_ATTR_CODE_EXTERNAL } from '../constants';
import { Code } from './base';

export abstract class External extends Code {
  public build(ctx: Compilation): IRDeclaration {
    const cache = ctx.codeCache;
    if (cache.has(this)) {
      return cache.get(this)!;
    }

    const sig = this.getSignature(ctx);
    const decl = ctx.declareFunction(sig, this.name);
    this.setAttributes(decl);
    cache.set(this, decl);
    return decl;
  }

  protected setAttributes(decl: IRDeclaration): void {
    super.setAttributes(decl);
    decl.attrs.add(FN_ATTR_CODE_EXTERNAL);
  }
}
