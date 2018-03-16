import { Compilation, IRBasicBlock } from '../compilation';
import { Node } from './base';

export class Empty extends Node {
  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
