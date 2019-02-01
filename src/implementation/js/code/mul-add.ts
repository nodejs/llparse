import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { SIGNED_LIMITS, UNSIGNED_LIMITS } from '../constants';
import { Field } from './field';

export class MulAdd extends Field<frontend.code.MulAdd> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    const options = this.ref.options;
    const ty = ctx.getFieldType(this.ref.field);

    const field = this.field(ctx);

    const match = ctx.matchVar();
    let base = options.base.toString();

    if (ty === 'i64') {
      // Convert `match` to BigInt
      out.push(`${ctx.matchVar()} = BigInt(${ctx.matchVar()});`);
      out.push('');

      base += 'n';
    }

    const limits = options.signed ? SIGNED_LIMITS : UNSIGNED_LIMITS;
    assert(limits.has(ty), `Unexpected mulAdd type "${ty}"`);
    const [ min, max ] = limits.get(ty)!;

    let mulMax = `${max} / ${base}`;
    let mulMin = `${min} / ${base}`;

    // Round division results to integers
    if (ty !== 'i64') {
      if (options.signed) {
        mulMax = `((${mulMax}) | 0)`;
        mulMin = `((${mulMin}) | 0)`;
      } else {
        mulMax = `((${mulMax}) >>> 0)`;
        mulMin = `((${mulMin}) >>> 0)`;
      }
    }

    out.push('// Multiplication overflow');
    out.push(`if (${field} > ${mulMax}) {`);
    out.push('  return 1;');
    out.push('}');
    if (options.signed) {
      out.push(`if (${field} < ${mulMin}) {`);
      out.push('  return 1;');
      out.push('}');
    }
    out.push('');

    out.push(`${field} *= ${base};`);
    out.push('');

    out.push('// Addition overflow');
    out.push(`if (${match} >= 0) {`);
    out.push(`  if (${field} > ${max} - ${match}) {`);
    out.push('    return 1;');
    out.push('  }');
    out.push('} else {');
    out.push(`  if (${field} < ${min} - ${match}) {`);
    out.push('    return 1;');
    out.push('  }');
    out.push('}');

    out.push(`${field} += ${match};`);

    if (options.max !== undefined) {
      let max = options.max.toString();

      if (ty === 'i64') {
        max += 'n';
      }

      out.push('');
      out.push('// Enforce maximum');
      out.push(`if (${field} > ${max}) {`);
      out.push('  return 1;');
      out.push('}');
    }

    out.push('return 0;');
  }
}
