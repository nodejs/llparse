import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Code } from './base';

export abstract class External<T extends frontend.code.External>
  extends Code<T> {

  public build(ctx: Compilation, out: string[]): void {
    out.push(`int ${this.ref.name}(`);
    out.push(`    ${ctx.prefix}_t* s, const unsigned char* p,`);
    if (this.ref.signature === 'value') {
      out.push('    const unsigned char* endp,');
      out.push('    int value);');
    } else {
      out.push('    const unsigned char* endp);');
    }
  }
}
