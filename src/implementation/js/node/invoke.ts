import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

export class Invoke extends Node<frontend.node.Invoke> {
  public doBuild(out: string[]): void {
    const ctx = this.compilation;

    const code = ctx.unwrapCode(this.ref.code);
    const codeDecl = ctx.buildCode(code);

    const args: string[] = [
      ctx.stateArg(),
      ctx.posArg(),
      ctx.endPosArg(),
    ];

    const signature = code.ref.signature;
    if (signature === 'value') {
      args.push(ctx.matchVar());
    }

    out.push(`switch (${codeDecl}(${args.join(', ')})) {`);
    let tmp: string[];

    for (const edge of this.ref.edges) {
      out.push(`  case ${edge.code}:`);
      tmp = [];
      this.tailTo(tmp, {
        noAdvance: true,
        node: edge.node,
        value: undefined,
      });
      ctx.indent(out, tmp, '    ');
    }

    out.push('  default:');
    tmp = [];
    this.tailTo(tmp, this.ref.otherwise!);
    ctx.indent(out, tmp, '    ');
    out.push('}');
  }
}
