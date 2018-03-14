import * as assert from 'assert';
import { Buffer } from 'buffer';

import { Transform } from '../../transform';
import * as node from './node';
import { INodePosition, NodeContext } from './node-context';
import { Compilation, INodeID, BasicBlock, Func, values } from './compilation';

interface ITrampoline {
  block: BasicBlock;
  phi?: values.instructions.Phi;
}

export interface INodeChild {
  node: Node;
  noAdvance: boolean;
  key: Buffer;
}

export abstract class Node {
  public name: string;
  public sourceName: string;

  protected otherwise: Node | undefined;
  protected skip: boolean = false;

  protected transform: Transform | undefined;
  protected privNoPrologueCheck: boolean = false;
  protected hasPause: boolean = false;
  private trampolines: Map<Node, > = new Map();

  constructor(public readonly kind: string, id: INodeID) {
    this.name = id.name;
    this.sourceName = id.sourceName;
  }

  public get noPrologueCheck(): boolean { return this.privNoPrologueCheck; }

  public setOtherwise(otherwise: Node, skip: boolean) {
    this.otherwise = otherwise;
    this.skip = skip;
  }

  public getChildren(): ReadonlyArray<INodeChild> {
    return [ { node: this.otherwise, noAdvance: !this.skip, key: undefined } ];
  }

  public getResumptionTargets(): Node[] {
    if (this.hasPause) {
      return [ this ];
    } else {
      return [];
    }
  }

  // Building

  public build(compilation: Compilation, nodes: Map<Node, Func>): Func {
    if (nodes.has(this)) {
      return nodes.get(this)!;
    }

    const fn = compilation.fn(compilation.signature.node, this.name);
    const ctx = new NodeContext(compilation, this.name, fn, nodes);

    // Errors are assumed to be rarely called
    // TODO(indutny): move this to node.Error somehow?
    if (this instanceof node.Error) {
      fn.attrs.add([ 'norecurse', 'cold', 'writeonly', 'noinline' ]);
    }

    nodes.set(this, fn);

    let body = fn.body;
    ctx.debug(body, 'enter');
    body = this.prologue(ctx, body);

    ctx.pos.next = body.getelementptr(ctx.pos.current, ctx.INT.val(1));

    this.doBuild(ctx, body);

    return fn;
  }

  protected prologue(ctx: Compilation, body: BasicBlock): BasicBlock {
    if (this.privNoPrologueCheck) {
      return body;
    }

    const pos = ctx.pos.current;
    const endPos = ctx.endPos;

    // Check that we have enough chars to do the read
    const cmp = body.icmp('ne', pos, endPos);

    const branch = ctx.branch(body, cmp);

    // Return self when `pos === endpos`
    branch.right.name = 'no_data';
    this.pause(ctx, branch.right);

    branch.left.name = 'has_data';
    return branch.left;
  }

  protected pause(ctx: Compilation, body: BasicBlock): void {
    const fn = ctx.fn;
    const bitcast = body.cast('bitcast', fn, fn.ty.toSignature().returnType);
    body.ret(bitcast);

    // To be used in `compiler.js`
    this.hasPause = true;
  }

  protected buildNode(ctx: Compilation, node: Node): Func {
    return node.build(ctx.compilation, ctx.nodes);
  }

  protected tailTo(ctx: Compilation, body: BasicBlock, pos: INodePosition,
                   node: Node, value?: number): Func {
    const target = this.buildNode(ctx, node);

    const isCacheable = ctx.pos.next === pos;

    if (isCacheable && this.trampolines.has(target)) {
      const cached = this.trampolines.get(target);

      if (cached.phi !== undefined) {
        assert(value,  '`.match()` and `.select()` with the same target');
        cached.phi.addEdge({
          fromBlock: body,
          value: ctx.TYPE_MATCH.val(value)
        });
      } else {
        assert(!value,  '`.match()` and `.select()` with the same target');
      }

      body.jmp(cached.trampoline);
      return target;
    }

    // Split, so that others could join us from code block above
    const trampoline = body.parent.createBlock(body.name + '.trampoline');
    body.jmp(trampoline);
    let phi = null;

    // Compute `match` if needed
    if (value !== null) {
      phi = trampoline.phi({
        fromBlock: body,
        value: ctx.TYPE_MATCH.val(value)
      });
    }

    if (isCacheable) {
      this.phis.set(target, { phi, block: trampoline });
    }

    const call = trampoline.call(target, [
      ctx.state,
      pos,
      ctx.endPos,
      phi ? phi : ctx.TYPE_MATCH.undef()
    ], 'musttail');

    trampoline.ret(call);

    return target;
  }

  protected doOtherwise(ctx: Compilation, body: BasicBlock,
                        pos?: INodePosition): Func {
    if (pos === undefined) {
      pos = ctx.pos;
    }

    // `.skipTo()` advances by one byte
    // `.otherwise()` redirects using the same byte
    const next = this.skip ? pos!.next : pos!.current;

    assert(this.otherwise);
    return this.tailTo(ctx, body, next, this.otherwise);
  }

  protected abstract doBuild(ctx: Compilation, body: BasicBlock);
}
