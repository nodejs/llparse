import { Compilation, IRBasicBlock } from '../compilation';
import { toCacheKey } from '../utils';
import { FieldValue } from './field-value';

export class Or extends FieldValue {
  constructor(name: string, field: string, value: number) {
    super('match', `or_${field}_${toCacheKey(value)}`, name, field, value);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const value = bb.load(ctx.stateField(bb, this.field));
    const result = bb.binop('or', value, value.ty.val(this.value));
    bb.ret(ctx.truncate(bb, result, bb.parent.ty.toSignature().returnType));
  }
}
