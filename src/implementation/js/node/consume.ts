import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

export class Consume extends Node<frontend.node.Consume> {
  public doBuild(out: string[]): void {
    const ctx = this.compilation;

    const index = ctx.stateField(this.ref.field);

    out.push(`const avail = ${ctx.bufArg()}.length - ${ctx.offArg()};`);
    out.push(`const need = ${index};`);
    out.push('if (avail >= need) {');
    out.push(`  off += need;`);
    out.push(`  ${index} = 0;`);

    const tmp: string[] = [];
    this.tailTo(tmp, this.ref.otherwise!);
    ctx.indent(out, tmp, '  ');

    out.push('}');
    out.push('');

    out.push(`${index} -= avail;`);
    this.pause(out);
  }
}
