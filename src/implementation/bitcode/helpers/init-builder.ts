import { Compilation, IRValue } from '../compilation';
import { ARG_STATE, ATTR_STATE, STATE_CURRENT } from '../constants';

export class InitBuilder {
  public build(ctx: Compilation, current: IRValue): void {
    const sig = ctx.ir.signature(ctx.ir.void(), [ ctx.state.ptr() ]);
    const fn = ctx.defineFunction(sig, `${ctx.prefix}_init`, [ ARG_STATE ]);
    fn.paramAttrs[0].add(ATTR_STATE);

    fn.linkage = 'external';

    const bb = fn.body;
    for (const field of ctx.state.fields) {
      const ptr = ctx.stateField(bb, field.name);
      if (field.name === STATE_CURRENT) {
        bb.store(current, ptr);
      } else if (field.ty.isInt()) {
        bb.store(field.ty.toInt().val(0), ptr);
      } else if (field.ty.isPointer()) {
        bb.store(field.ty.toPointer().val(null), ptr);
      } else {
        throw new Error(
          `Unknown state property type: "${field.ty.typeString}"`);
      }
    }
    bb.ret();
  }
}
