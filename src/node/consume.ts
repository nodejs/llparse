import { Compilation, IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { Node } from './base';

export class Consume extends Node {
  constructor(id: IUniqueName, private readonly field: string) {
    super(id);
  }

  protected doBuild(bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
