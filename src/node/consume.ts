import { Compilation, IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';

export class Consume extends Node {
  constructor(id: IUniqueName, private readonly field: string) {
    super(id);
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    // TODO(indutny): implement me
    this.pause(bb);
  }
}
