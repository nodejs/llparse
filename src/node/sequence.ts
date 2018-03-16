import * as assert from 'assert';
import { Buffer } from 'buffer';

import { IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';
import { Match } from './match';

export class Sequence extends Match {
  private onMatch: Node | undefined;

  constructor(id: IUniqueName, private readonly select: Buffer) {
    super(id);
  }

  public setOnMatch(node: Node) {
    assert.strictEqual(this.onMatch, undefined);
    this.onMatch = node;
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    // TODO(indutny): implement me
    this.pause(bb);
  }
}
