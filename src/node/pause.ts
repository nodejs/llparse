import { IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { INodePosition } from './base';
import { Error as ErrorNode } from './error';

export class Pause extends ErrorNode {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    // TODO(indutny): implement me
    this.pause(bb);
  }
}
