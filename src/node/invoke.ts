import { Code } from '../code';
import { Compilation, IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { Node } from './base';

export class Invoke extends Node {
  constructor(id: IUniqueName, private readonly code: Code) {
    super(id);
  }

  public addEdge(node: Node, key: number) {
    // TODO(indutny): implement me
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
