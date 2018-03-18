import { Compilation, IRBasicBlock } from '../compilation';
import { toCacheKey } from '../utils';
import { FieldValue } from './field-value';

export class Test extends FieldValue {
  constructor(name: string, field: string, value: number) {
    super('match', `test_${field}_${toCacheKey(value)}`, name, field, value);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const field = bb.load(ctx.stateField(bb, this.field));
    const masked = bb.binop('and', field, field.ty.toInt().val(this.value));
    const bool = bb.icmp('eq', masked, field.ty.toInt().val(this.value));
    bb.ret(ctx.truncate(bb, bool, bb.parent.ty.toSignature().returnType));
  }
}
