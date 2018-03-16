import * as assert from 'assert';
import { Buffer } from 'buffer';

import { IUniqueName } from '../utils';
import { Node } from './base';

export class Sequence extends Node {
  private onMatch: Node | undefined;

  constructor(id: IUniqueName, private readonly select: Buffer) {
    super(id);
  }

  public setOnMatch(node: Node) {
    assert.strictEqual(this.onMatch, undefined);
    this.onMatch = node;
  }
}
