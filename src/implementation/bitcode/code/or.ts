import * as frontend from 'llparse-frontend';

import { Compilation, IRBasicBlock } from '../compilation';
import { Field } from './field';

export class Or extends Field<frontend.code.Or> {
  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const ptr = ctx.stateField(bb, this.ref.field);
    const field = bb.load(ptr);
    const result = bb.binop('or', field, field.ty.val(this.ref.value));
    bb.store(result, ptr);

    bb.ret(bb.parent.ty.toSignature().returnType.toInt().val(0));
  }
}
