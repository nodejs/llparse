import { IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';

export class Pause extends Node {
  constructor(id: IUniqueName, private readonly code: number,
              private readonly reason: string) {
    super(id);
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    // TODO(indutny): implement me
    this.pause(bb);
  }
}
