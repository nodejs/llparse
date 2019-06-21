import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

export class Single extends Node<frontend.node.Single> {
  public doBuild(out: string[]): void {
    const ctx = this.compilation;

    const otherwise = this.ref.otherwise!;

    this.prologue(out);

    const transform = ctx.unwrapTransform(this.ref.transform!);
    const current = transform.build(ctx, `*${ctx.posArg()}`);

    out.push(`switch (${current}) {`)
    this.ref.edges.forEach((edge) => {
      let ch: string;

      // Non-printable ASCII, or single-quote, or forward slash
      if (edge.key < 0x20 || edge.key > 0x7e || edge.key === 0x27 ||
          edge.key === 0x5c) {
        ch = edge.key.toString();
      } else {
        ch = `'${String.fromCharCode(edge.key)}'`;
      }
      out.push(`  case ${ch}: {`);

      const tmp: string[] = [];
      this.tailTo(tmp, edge);
      ctx.indent(out, tmp, '    ');

      out.push('  }');
    });

    out.push(`  default: {`);

    const tmp: string[] = [];
    this.tailTo(tmp, otherwise);
    ctx.indent(out, tmp, '    ');

    out.push('  }');

    out.push(`}`);
  }
}
