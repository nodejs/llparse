import { Compilation, IRDeclaration, IRSignature } from '../compilation';
import {
  ARG_ENDPOS, ARG_MATCH, ARG_POS, ARG_STATE,
  ATTR_ENDPOS, ATTR_MATCH, ATTR_POS, ATTR_STATE,
} from '../constants';

export type Signature = 'match' | 'value' | 'span';

export abstract class Code {
  protected cachedDecl: IRDeclaration | undefined;

  constructor(public readonly signature: Signature,
              public readonly cacheKey: string,
              public readonly name: string) {
  }

  public abstract build(ctx: Compilation): IRDeclaration;

  protected getSignature(ctx: Compilation): IRSignature {
    switch (this.signature) {
      case 'match': return ctx.signature.callback.match;
      case 'value': return ctx.signature.callback.value;
      case 'span': return ctx.signature.callback.span;
      default: throw new Error(`Unknown signature "${this.signature}"`);
    }
  }

  protected getParams(): ReadonlyArray<string> {
    // TODO(indutny): move this to `Compilation`, or move above signatures here?
    switch (this.signature) {
      case 'match': return [ ARG_STATE, ARG_POS, ARG_ENDPOS ];
      case 'value': return [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_MATCH ];
      case 'span': return [ ARG_STATE, ARG_POS, ARG_ENDPOS ];
      default: throw new Error(`Unknown signature "${this.signature}"`);
    }
  }

  protected setAttributes(decl: IRDeclaration): void {
    // TODO(indutny): move this to `Compilation`, or move above signatures here?
    switch (this.signature) {
      case 'value':
        decl.paramAttrs[3].add(ATTR_MATCH);
      case 'match':
      case 'span':
        decl.paramAttrs[2].add(ATTR_ENDPOS);
        decl.paramAttrs[1].add(ATTR_POS);
        decl.paramAttrs[0].add(ATTR_STATE);
        break;
      default: throw new Error(`Unknown signature "${this.signature}"`);
    }
  }
}
