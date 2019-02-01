import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

export class Consume extends Node<frontend.node.Consume> {
  public doBuild(out: string[]): void {
    const ctx = this.compilation;

    const index = ctx.stateField(this.ref.field);
    const ty = ctx.getFieldType(this.ref.field);

    out.push(`let avail = ${ctx.bufArg()}.length - ${ctx.offArg()};`);
    out.push(`const need = ${index};`);
    if (ty === 'i64') {
      out.push('avail = BigInt(avail);');
    }
    out.push('if (avail >= need) {');
    out.push(`  off += ${ ty === 'i64' ? 'Number(need)' : 'need' };`);
    out.push(`  ${index} = ${ ty === 'i64' ? '0n' : '' };`);

    const tmp: string[] = [];
    this.tailTo(tmp, this.ref.otherwise!);
    ctx.indent(out, tmp, '  ');

    out.push('}');
    out.push('');

    out.push(`${index} -= avail;`);
    this.pause(out);
  }
}
