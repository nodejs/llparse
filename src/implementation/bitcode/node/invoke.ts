import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import { Code } from '../code';
import { IRBasicBlock, IRValue } from '../compilation';
import { CONTAINER_KEY } from '../constants';
import { INodePosition, Node } from './base';

export class Invoke extends Node<frontend.node.Invoke> {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const ctx = this.compilation;

    // TODO(indutny): declare the type
    const code = (this.ref.code as frontend.ContainerWrap<frontend.code.Code>)
        .get<Code<frontend.code.Code>>(CONTAINER_KEY);
    const codeDecl = code.build(ctx);

    const args: IRValue[] = [
      ctx.stateArg(bb),
      pos.current,
      ctx.endPosArg(bb),
    ];

    const signature = code.ref.signature;
    if (signature === 'value') {
      args.push(ctx.matchArg(bb));
    } else {
      assert.strictEqual(signature, 'match',
        'Passing `span` callback to `invoke` is not allowed');
    }

    const call = bb.call(codeDecl, args);

    const keys = this.ref.edges.map((edge) => edge.code);

    const s = ctx.switch(bb, call, keys, {
      cases: this.ref.edges.map((edge) => {
        return edge.node.ref instanceof frontend.node.Error ?
          'unlikely' : 'likely';
      }),
      otherwise: this.ref.otherwise! instanceof frontend.node.Error ?
          'unlikely' : 'likely',
    });

    s.cases.forEach((childBB, index) => {
      const edge = this.ref.edges[index]!;
      this.tailTo(childBB, {
        noAdvance: true,
        node: edge.node,
        value: undefined,
      }, pos);
    });

    this.tailTo(s.otherwise, this.ref.otherwise!, pos);
  }
}
