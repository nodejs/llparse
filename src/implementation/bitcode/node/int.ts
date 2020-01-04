import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import { Code } from '../code';
import { IRBasicBlock, IRValue } from '../compilation';
import { CONTAINER_KEY } from '../constants';
import { INodePosition, Node } from './base';

export class Int extends Node<frontend.node.Int> {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const otherwise = this.ref.otherwise!;

    if (!otherwise.noAdvance) {
      bb = this.prologue(bb, pos);
    }

    this.tailTo(bb, otherwise, pos);
  }
}
