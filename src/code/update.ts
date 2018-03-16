import { Compilation, IRBasicBlock } from '../compilation';
import { FieldValue } from './field-value';

export class Update extends FieldValue {
  constructor(name: string, field: string, value: number) {
    super('match', name, field, value);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
