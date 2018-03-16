import { Compilation, IRBasicBlock, IRDeclaration } from '../compilation';
import {
  ARG_ENDPOS, ARG_MATCH, ARG_POS, ARG_STATE,
  ATTR_ENDPOS, ATTR_MATCH, ATTR_POS, ATTR_STATE,
  CCONV,
  FN_ATTR_NODE,
  LINKAGE,
} from '../constants';
import { IUniqueName } from '../utils';

export interface INodeOtherwise {
  readonly target: Node;
  readonly noAdvance: boolean;
}

export abstract class Node {
  private privOtherwise: INodeOtherwise | undefined;

  constructor(public readonly id: IUniqueName) {
  }

  public get otherwise(): INodeOtherwise | undefined {
    return this.privOtherwise;
  }

  public setOtherwise(target: Node, noAdvance: boolean) {
    this.privOtherwise = { target, noAdvance };
  }

  // Building

  public build(ctx: Compilation): IRDeclaration {
    const cache = ctx.nodeCache;
    if (cache.has(this)) {
      return cache.get(this)!;
    }

    const fn = ctx.defineFunction(ctx.signature.node, this.id.name, [
      ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_MATCH,
    ]);

    fn.cconv = CCONV;
    fn.linkage = LINKAGE;

    fn.paramAttrs[0].add(ATTR_STATE);
    fn.paramAttrs[1].add(ATTR_POS);
    fn.paramAttrs[2].add(ATTR_ENDPOS);
    fn.paramAttrs[3].add(ATTR_MATCH);
    fn.attrs.add(FN_ATTR_NODE);

    this.doBuild(ctx, fn.body);

    cache.set(this, fn);
    return fn;
  }

  protected abstract doBuild(ctx: Compilation, bb: IRBasicBlock): void;

  // Helpers
}
