import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { SIGNED_LIMITS, UNSIGNED_LIMITS, SIGNED_TYPES } from '../constants';
import { Field } from './field';

export class MulAdd extends Field<frontend.code.MulAdd> {
  protected doBuild(ctx: Compilation, out: string[]): void {
    const options = this.ref.options;
    const ty = ctx.getFieldType(this.ref.field);

    let field = this.field(ctx);
    if (options.signed) {
      assert(SIGNED_TYPES.has(ty), `Unexpected mulAdd type "${ty}"`);
      const targetTy = SIGNED_TYPES.get(ty)!;
      out.push(`${targetTy}* field = (${targetTy}*) &${field};`);
      field = '(*field)';
    }

    const match = ctx.matchVar();

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
