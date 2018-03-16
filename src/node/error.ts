import { IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';

class ErrorNode extends Node {
  constructor(id: IUniqueName, private readonly code: number,
              private readonly reason: string) {
    super(id);
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    // TODO(indutny): implement me
    this.pause(bb);
  }
}

export { ErrorNode as Error };
