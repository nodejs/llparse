import { IRBasicBlock } from '../compilation';
import { Span } from '../span';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';

export class SpanEnd extends Node {
  constructor(id: IUniqueName, private readonly span: Span) {
    super(id);
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    // TODO(indutny): implement me
    this.pause(bb);
  }
}
