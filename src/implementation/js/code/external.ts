import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Code } from './base';

export abstract class External<T extends frontend.code.External>
  extends Code<T> {

  public buildGlobal(ctx: Compilation, out: string[]): void {
    ctx.importCode(this.ref.name, out);
  }

  public build(ctx: Compilation, out: string[]): void {
    const args = [ ctx.bufArg(), ctx.offArg() ];
    if (this.ref.signature === 'value') {
      args.push(ctx.matchVar());
    }

    out.push(`_${this.ref.name}(${args.join(', ')}) {`);
    out.push(`  return ${this.ref.name}(this, ${args.join(', ')});`);
    out.push(`}`);
  }
}
