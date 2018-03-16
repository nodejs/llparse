import { Compilation, IRBasicBlock } from '../compilation';
import { Field } from './field';

export class Store extends Field {
  constructor(name: string, field: string) {
    super('value', `store_${field}`, name, field);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
