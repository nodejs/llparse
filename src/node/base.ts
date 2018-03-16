import {
  Compilation, IRBasicBlock, IRDeclaration, IRValue,
} from '../compilation';
import {
  ARG_ENDPOS, ARG_MATCH, ARG_POS, ARG_STATE,
  ATTR_ENDPOS, ATTR_MATCH, ATTR_POS, ATTR_STATE,
  CCONV,
  FN_ATTR_NODE,
  GEP_OFF,
  LINKAGE,
} from '../constants';
import { IUniqueName } from '../utils';

export interface INodeEdge {
  readonly node: Node;
  readonly noAdvance: boolean;
}

export interface INodePosition {
  readonly current: IRValue;
  readonly next: IRValue;
}

export abstract class Node {
  protected otherwise: INodeEdge | undefined;
  private privCompilation: Compilation | undefined;
  private cachedDecl: IRDeclaration | undefined;

  constructor(public readonly id: IUniqueName) {
  }

  public setOtherwise(node: Node, noAdvance: boolean) {
    this.otherwise = { node, noAdvance };
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

    const pos: INodePosition = {
      current: ctx.posArg(fn.body),
      next: fn.body.getelementptr(ctx.posArg(fn.body), GEP_OFF.val(1)),
    };
    this.doBuild(fn.body, pos);

    this.cachedDecl = fn;
    return fn;
  }

  protected abstract doBuild(bb: IRBasicBlock, pos: INodePosition): void;

  // Helpers

  protected get compilation(): Compilation {
    return this.privCompilation!;
  }

  protected pause(bb: IRBasicBlock) {
    const ctx = this.compilation;
    const fn = bb.parent;

    const self = bb.cast('bitcast', fn, fn.ty.toSignature().returnType);
    bb.ret(self);

    ctx.addResumptionTarget(fn);
  }

  protected tailTo(bb: IRBasicBlock, edge: INodeEdge, pos: INodePosition)
    : void {
    const ctx = this.compilation;
    const targetDecl = edge.node.build(ctx);

    const args = [
      ctx.stateArg(bb),
      edge.noAdvance ? pos.current : pos.next,
      ctx.endPosArg(bb),
      ctx.matchArg(bb).ty.undef(),
    ];

    const res = bb.call(targetDecl, args, 'musttail');
    bb.ret(res);
  }
}
