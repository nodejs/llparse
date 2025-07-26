import * as frontend from 'llparse-frontend';
import * as assert from 'assert';
import { UNSIGNED_LIMITS, UNSIGNED_TYPES } from '../constants';
import { Compilation } from '../compilation';
import { Field } from './field';

export class Unpack extends Field<frontend.code.Unpack>{
    // big endian will be rshift and little will be lshift
    protected doBuild(ctx: Compilation, out: string[]): void {
        const ty = ctx.getFieldType(this.ref.field);
        assert(UNSIGNED_TYPES.has(ty), `Unexpected Unpack type "${ty}"`);
        const targetTy = UNSIGNED_TYPES.get(ty)!;
        const limit = UNSIGNED_LIMITS.get(ty)!;
        const match = ctx.matchVar();
        
        /* NOTE: (Vizonex) Feel free to correct me if I'm wrong here about this C code. */
        if (!this.ref.bigEndian){    
            /* lshift */
            out.push(`if (${this.field(ctx)} > 0){`);
            out.push(`  ${targetTy} __lshift_val = ${this.field(ctx)} << 8;`);
            out.push(`  if (__lshift_val > ${limit[1]} || __lshift_val < ${this.field(ctx)}){`);
            out.push("    /* overflow */");
            out.push("    return 1;");
            out.push("  }");
            out.push(`  ${this.field(ctx)} = __lshift_val | ${match}`);
        } else {
            out.push(`if (${this.field(ctx)} > 0){`);
            out.push(`  ${targetTy} __rshift_val = ${this.field(ctx)} >> 8;`);
            out.push(`  if (__rshift_val > ${limit[1]} || __rshift_val < ${this.field(ctx)}){`);
            out.push("    /* overflow */");
            out.push(`    return 1;`);
            out.push(`  }`);
            out.push(`  ${this.field(ctx)} =  ${match} | __rshift_val`);
            out.push(`}`);
            
        }
        /** if first value simply setting it in should be enough... */
        out.push("} else {");
        out.push(`  ${this.field(ctx)} = ${match};`);
        out.push("}  ");
        out.push("return 0;");
    }
}