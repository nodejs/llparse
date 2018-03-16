import { Compilation, IRBasicBlock } from '../compilation';
import { Field } from './field';

export class Load extends Field {
  constructor(name: string, field: string) {
    super('match', name, field);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
