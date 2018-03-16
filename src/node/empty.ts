import { IRBasicBlock } from '../compilation';
import { INodePosition, Node } from './base';

export class Empty extends Node {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    // TODO(indutny): implement me
    this.pause(bb);
  }
}
