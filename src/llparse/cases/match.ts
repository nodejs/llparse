import * as assert from 'assert';
import { Buffer } from 'buffer';

import * as node from '../node';
import * as utils from '../utils';
import { ICaseLinearizeResult, Case } from './case';

export class Match extends Case {
  public readonly key: Buffer;

  constructor(key: string, next: node.Node) {
    super('match', next);

    this.key = utils.toBuffer(key);
    assert(this.key.length > 0,
      '`.match()` must get at least 1 byte as a first argument');
  }

  public linearize(): ICaseLinearizeResult[] {
    return [ {
      key: this.key,
      next: this.next,
      value: undefined,
      noAdvance: false
    } ];
  }
}
