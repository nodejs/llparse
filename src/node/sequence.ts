import * as assert from 'assert';
import { Buffer } from 'buffer';

import { IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';
import { Match } from './match';

export interface ISequenceEdge {
  readonly node: Node;
  readonly value: number | undefined;
}

export class Sequence extends Match {
  private edge: ISequenceEdge | undefined;

  constructor(id: IUniqueName, private readonly select: Buffer) {
    super(id);
  }

  public setEdge(node: Node, value: number | undefined) {
    assert.strictEqual(this.edge, undefined);
    this.edge = { node, value };
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    // TODO(indutny): implement me
    this.pause(bb);
  }
}
