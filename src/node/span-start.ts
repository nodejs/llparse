import { Compilation, IRBasicBlock } from '../compilation';
import { Span } from '../span';
import { IUniqueName } from '../utils';
import { Node } from './base';

export class SpanStart extends Node {
  constructor(id: IUniqueName, private readonly span: Span) {
    super(id);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
