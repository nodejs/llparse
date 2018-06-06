import * as frontend from 'llparse-frontend';

import { IRBasicBlock } from '../compilation';
import { INodePosition, Node } from './base';

export class Empty extends Node<frontend.node.Empty> {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const otherwise = this.ref.otherwise!;

    if (!otherwise.noAdvance) {
      bb = this.prologue(bb, pos);
    }

    this.tailTo(bb, otherwise, pos);
  }
}
