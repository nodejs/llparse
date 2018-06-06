import * as frontend from 'llparse-frontend';

import { Compilation, IRBasicBlock } from '../compilation';
import { Field } from './field';

export class Store extends Field<frontend.code.Store> {
  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const ptr = ctx.stateField(bb, this.ref.field);
    bb.store(ctx.truncate(bb, ctx.matchArg(bb), ptr.ty.toPointer().to), ptr);
    bb.ret(bb.parent.ty.toSignature().returnType.toInt().val(0));
  }
}
