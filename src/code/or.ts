import { Compilation, IRBasicBlock } from '../compilation';
import { toCacheKey } from '../utils';
import { FieldValue } from './field-value';

export class Or extends FieldValue {
  constructor(name: string, field: string, value: number) {
    super('match', `or_${field}_${toCacheKey(value)}`, name, field, value);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const ptr = ctx.stateField(bb, this.field);
    const field = bb.load(ptr);
    const result = bb.binop('or', field, field.ty.val(this.value));
    bb.store(result, ptr);

    bb.ret(bb.parent.ty.toSignature().returnType.toInt().val(0));
  }
}
