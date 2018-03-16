import { Compilation, IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { Node } from './base';

export class Pause extends Node {
  constructor(id: IUniqueName, private readonly code: number,
              private readonly reason: string) {
    super(id);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
