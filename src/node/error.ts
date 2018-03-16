import { IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { Node } from './base';

class ErrorNode extends Node {
  constructor(id: IUniqueName, private readonly code: number,
              private readonly reason: string) {
    super(id);
  }

  protected doBuild(bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}

export { ErrorNode as Error };
