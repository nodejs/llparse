import * as frontend from 'llparse-frontend';

import { Compilation, IRBasicBlock } from '../compilation';
import { Field } from './field';

export class IsEqual extends Field<frontend.code.IsEqual> {
  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const value = bb.load(ctx.stateField(bb, this.ref.field));
    const result = bb.icmp('eq', value, value.ty.val(this.ref.value));
    bb.ret(ctx.truncate(bb, result, bb.parent.ty.toSignature().returnType));
  }
}
