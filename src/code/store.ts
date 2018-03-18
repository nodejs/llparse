import { Compilation, IRBasicBlock } from '../compilation';
import { Field } from './field';

export class Store extends Field {
  constructor(name: string, field: string) {
    super('value', `store_${field}`, name, field);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const ptr = ctx.stateField(bb, this.field);
    bb.store(ctx.truncate(bb, ctx.matchArg(bb), ptr.ty.toPointer().to), ptr);
    bb.ret(bb.parent.ty.toSignature().returnType.toInt().val(0));
  }
}
