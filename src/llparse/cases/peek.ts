import * as assert from 'assert';
import { Buffer } from 'buffer';

import * as node from '../node';
import * as utils from '../utils';
import { Case, ICaseLinearizeResult } from './case';

export class Peek extends Case {
  public readonly key: Buffer;

  constructor(key: string, next: node.Node) {
    super('peek', next);

    this.key = utils.toBuffer(key);
    assert.strictEqual(this.key.length, 1,
      '`.peek()` must get exactly 1 byte as a first argument');
  }

  public linearize(): ICaseLinearizeResult[] {
    return [ {
      key: this.key,
      next: this.next,
      value: undefined,
      noAdvance: true
    } ];
  }
}
