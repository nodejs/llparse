import {
  Compilation, IRBasicBlock, IRDeclaration, IRPhi, IRValue,
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
  readonly value: number | undefined;
}

export interface INodePosition {
  readonly current: IRValue;
  readonly next: IRValue;
}

interface ITail {
  readonly block: IRBasicBlock;
  readonly phi: IRPhi;
}

type SubTailMap = Map<Node, ITail>;
type TailMap = Map<boolean, SubTailMap>;

export abstract class Node {
  protected otherwise: INodeEdge | undefined;
  private privCompilation: Compilation | undefined;
  private cachedDecl: IRDeclaration | undefined;

  // `noAdvance` => `target` => tail
  private tailMap: TailMap = new Map();

  constructor(public readonly id: IUniqueName) {
    this.tailMap.set(true, new Map());
    this.tailMap.set(false, new Map());
  }

  public setOtherwise(node: Node, noAdvance: boolean) {
    this.otherwise = { node, noAdvance, value: undefined };
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

    // Cache early to break loops
    this.cachedDecl = fn;

    const pos: INodePosition = {
      current: ctx.posArg(fn.body),
      next: fn.body.getelementptr(ctx.posArg(fn.body), GEP_OFF.val(1)),
    };
    this.doBuild(fn.body, pos);

    return fn;
  }

  protected abstract doBuild(bb: IRBasicBlock, pos: INodePosition): void;

  // Helpers

  protected get compilation(): Compilation {
    return this.privCompilation!;
  }

  protected prologue(bb: IRBasicBlock, pos: INodePosition): IRBasicBlock {
    const ctx = this.compilation;

    // Check that we have enough chars to do the read
    const cmp = bb.icmp('ne', pos.current, ctx.endPosArg(bb));
    const { onTrue, onFalse } = ctx.branch(bb, cmp);

    // Return self when `pos === endpos`
    onFalse.name = 'no_data';
    this.pause(onFalse);

    onTrue.name = 'has_data';
    return onTrue;
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
    const subTailMap = this.tailMap.get(edge.noAdvance)!;
    const matchTy = ctx.matchArg(bb).ty;

    const value = edge.value === undefined ? matchTy.undef() :
      matchTy.val(edge.value);
    if (subTailMap.has(edge.node)) {
      const tail = subTailMap.get(edge.node)!;

      tail.phi.addEdge({ fromBlock: bb, value });
      bb.jmp(tail.block);
      return;
    }

    const tailBB = bb.parent.createBlock(bb.name + '.trampoline');
    bb.jmp(tailBB);

    const phi = tailBB.phi({ fromBlock: bb, value });
    subTailMap.set(edge.node, { block: tailBB, phi });

    const args = [
      ctx.stateArg(bb),
      edge.noAdvance ? pos.current : pos.next,
      ctx.endPosArg(bb),
      phi,
    ];

    const res = tailBB.call(edge.node.build(ctx), args, 'musttail');
    tailBB.ret(res);
  }
}
