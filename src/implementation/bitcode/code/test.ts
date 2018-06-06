import * as frontend from 'llparse-frontend';

import { Compilation, IRBasicBlock } from '../compilation';
import { Field } from './field';

export class Test extends Field<frontend.code.Test> {
  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const field = bb.load(ctx.stateField(bb, this.ref.field));
    const masked = bb.binop('and', field, field.ty.toInt().val(this.ref.value));
    const bool = bb.icmp('eq', masked, field.ty.toInt().val(this.ref.value));
    bb.ret(ctx.truncate(bb, bool, bb.parent.ty.toSignature().returnType));
  }
}
