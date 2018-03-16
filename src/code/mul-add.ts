import { Compilation, IRBasicBlock } from '../compilation';
import { Field } from './field';

export interface IMulAddOptions {
  readonly base: number;
  readonly max?: number;
  readonly signed?: boolean;
}

export class MulAdd extends Field {
  constructor(name: string, field: string,
              private readonly options: IMulAddOptions) {
    super('value', name, field);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
