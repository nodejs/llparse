import * as assert from 'assert';
import { Code } from '../code';
import { IRBasicBlock, IRValue } from '../compilation';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';
import { Error as ErrorNode } from './error';

interface IInvokeEdge {
  code: number;
  node: Node;
}

export class Invoke extends Node {
  private readonly edges: IInvokeEdge[] = [];

  constructor(id: IUniqueName, private readonly code: Code) {
    super(id);
  }

  public addEdge(code: number, node: Node): void {
    this.edges.push({ code, node });
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const ctx = this.compilation;
    const code = this.code.build(ctx);

    const args: IRValue[] = [
      ctx.stateArg(bb),
      pos.current,
      ctx.endPosArg(bb),
    ];

    if (this.code.signature === 'value') {
      args.push(ctx.matchArg(bb));
    } else {
      assert.strictEqual(this.code.signature, 'match',
        'Passing `span` callback to `invoke` is not allowed');
    }

    const call = bb.call(code, args);

    const keys = this.edges.map((edge) => edge.code);

    const s = ctx.switch(bb, call, keys, {
      cases: this.edges.map((edge) => {
        return edge.node instanceof ErrorNode ? 'unlikely' : 'likely';
      }),
      otherwise: this.otherwise! instanceof ErrorNode ? 'unlikely' : 'likely',
    });

    s.cases.forEach((childBB, index) => {
      const edge = this.edges[index]!;
      this.tailTo(childBB, {
        noAdvance: true,
        node: edge.node,
        value: undefined,
      }, pos);
    });

    this.tailTo(s.otherwise, this.otherwise!, pos);
  }
}
