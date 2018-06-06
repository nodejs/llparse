import * as frontend from 'llparse-frontend';

import { Compilation, IRDeclaration, IRSignature } from '../compilation';
import { FN_ATTR_CODE_EXTERNAL } from '../constants';
import { Code } from './base';

export abstract class External<T extends frontend.code.External>
  extends Code<T> {

  public build(ctx: Compilation): IRDeclaration {
    if (this.cachedDecl !== undefined) {
      return this.cachedDecl;
    }

    const sig = this.getSignature(ctx);
    const decl = ctx.declareFunction(sig, this.ref.name);
    this.setAttributes(decl);
    this.cachedDecl = decl;
    return decl;
  }

  protected setAttributes(decl: IRDeclaration): void {
    super.setAttributes(decl);
    decl.attrs.add(FN_ATTR_CODE_EXTERNAL);
  }
}
