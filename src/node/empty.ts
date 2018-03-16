import { IRBasicBlock } from '../compilation';
import { Node } from './base';

export class Empty extends Node {
  protected doBuild(bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
