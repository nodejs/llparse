import { Compilation, IRBasicBlock } from '../compilation';
import { toCacheKey } from '../utils';
import { FieldValue } from './field-value';

export class IsEqual extends FieldValue {
  constructor(name: string, field: string, value: number) {
    super('match', `is_equal_${field}_${toCacheKey(value)}`, name, field,
      value);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
