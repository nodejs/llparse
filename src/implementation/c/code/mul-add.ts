import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

const SIGNED_LIMITS: Map<string, [ string, string ]> = new Map();
SIGNED_LIMITS.set('i8', [ '-0x80', '0x7f' ]);
SIGNED_LIMITS.set('i16', [ '-0x8000', '0x7fff' ]);
SIGNED_LIMITS.set('i32', [ '(-0x7fffffff - 1)', '0x7fffffff' ]);
SIGNED_LIMITS.set('i64', [ '(-0x7fffffffffffffffLL - 1)',
    '0x7fffffffffffffffLL' ]);

const UNSIGNED_LIMITS: Map<string, [ string, string ]> = new Map();
UNSIGNED_LIMITS.set('i8', [ '0', '0xff' ]);
UNSIGNED_LIMITS.set('i8', [ '0', '0xff' ]);
UNSIGNED_LIMITS.set('i16', [ '0', '0xffff' ]);
UNSIGNED_LIMITS.set('i32', [ '0', '0xffffffff' ]);
UNSIGNED_LIMITS.set('i64', [ '0ULL', '0xffffffffffffffffULL' ]);

export class MulAdd extends Field<frontend.code.MulAdd> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    const ty = ctx.getFieldType(this.ref.field);

    const field = this.field(ctx);
    const match = ctx.matchVar();

    const options = this.ref.options;

    const limits = options.signed ? SIGNED_LIMITS : UNSIGNED_LIMITS;
    assert(limits.has(ty), `Unexpected mulAdd type "${ty}"`);
    const [ min, max ] = limits.get(ty)!;

    const mulMax = `${max} / ${options.base}`;
    const mulMin = `${min} / ${options.base}`;

    out.push('/* Multiplication overflow */');
    out.push(`if (${field} > ${mulMax}) {`);
    out.push('  return 1;');
    out.push('}');
    if (options.signed) {
      out.push(`if (${field} < ${mulMin}) {`);
      out.push('  return 1;');
      out.push('}');
    }
    out.push('');

    out.push(`${field} *= ${options.base};`);
    out.push('');

    out.push('/* Addition overflow */');
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
      out.push('');
      out.push('/* Enforce maximum */');
      out.push(`if (${field} > ${options.max}) {`);
      out.push('  return 1;');
      out.push('}');
    }

    out.push('return 0;');
  }
}
