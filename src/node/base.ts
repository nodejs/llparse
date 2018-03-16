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
  private privCompilation: Compilation | undefined;
  private cachedDecl: IRDeclaration | undefined;

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
    if (this.cachedDecl !== undefined) {
      return this.cachedDecl;
    }

    this.privCompilation = ctx;
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

    this.doBuild(fn.body);

    this.cachedDecl = fn;
    return fn;
  }

  protected abstract doBuild(bb: IRBasicBlock): void;

  // Helpers

  protected get compilation(): Compilation {
    return this.privCompilation!;
  }

  protected tailTo(bb: IRBasicBlock, noAdvance: boolean, target: Node): void {
    const ctx = this.compilation;
    const targetDecl = target.build(ctx);

    const args = [
      ctx.stateArg(bb),
      ctx.posArg(bb).ty.undef(),
      ctx.endPosArg(bb),
      ctx.matchArg(bb).ty.undef(),
    ];

    const res = bb.call(targetDecl, args, 'musttail');
    bb.ret(res);
  }
}
