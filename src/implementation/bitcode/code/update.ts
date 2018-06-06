import * as frontend from 'llparse-frontend';

import { Compilation, IRBasicBlock } from '../compilation';
import { Field } from './field';

export class Update extends Field<frontend.code.Update> {
  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const ptr = ctx.stateField(bb, this.ref.field);
    bb.store(ptr.ty.toPointer().to.toInt().val(this.ref.value), ptr);
    bb.ret(bb.parent.ty.toSignature().returnType.toInt().val(0));
  }
}
