import { Code } from '../code';
import { IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';

export class Invoke extends Node {
  constructor(id: IUniqueName, private readonly code: Code) {
    super(id);
  }

  public addEdge(node: Node, key: number) {
    // TODO(indutny): implement me
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    // TODO(indutny): implement me
    this.pause(bb);
  }
}
