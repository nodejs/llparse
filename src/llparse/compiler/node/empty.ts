import { Compilation, BasicBlock, INodeID } from '../compilation';
import { Node, INodeChild } from './base';

export class Empty extends Node {
  constructor(id: INodeID) {
    super('empty', id);
  }

  protected prologue(ctx: Compilation, body: BasicBlock): BasicBlock {
    if (this.skip)
      return super.prologue(ctx, body);
    return body;
  }

  protected doBuild(ctx: Compilation, body: BasicBlock): void {
    this.doOtherwise(ctx, body);
  }
}
