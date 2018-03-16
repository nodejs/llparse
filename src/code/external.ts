import { Compilation, IRDeclaration, IRSignature} from '../compilation';
import { FN_ATTR_CODE_EXTERNAL } from '../constants';
import { Code, Signature } from './base';

export abstract class External extends Code {
  constructor(signature: Signature, name: string) {
    super(signature, 'external_' + name, name);
  }

  public build(ctx: Compilation): IRDeclaration {
    if (this.cachedDecl !== undefined) {
      return this.cachedDecl;
    }

    const sig = this.getSignature(ctx);
    const decl = ctx.declareFunction(sig, this.name);
    this.setAttributes(decl);
    this.cachedDecl = decl;
    return decl;
  }

  protected setAttributes(decl: IRDeclaration): void {
    super.setAttributes(decl);
    decl.attrs.add(FN_ATTR_CODE_EXTERNAL);
  }
}
