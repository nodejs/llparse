import { IRBasicBlock } from '../compilation';
import { INodePosition, Node } from './base';

export class Empty extends Node {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const otherwise = this.otherwise!;

    if (!otherwise.noAdvance) {
      bb = this.prologue(bb, pos);
    }

    this.tailTo(bb, otherwise, pos);
  }
}
