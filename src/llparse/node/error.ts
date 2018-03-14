import * as assert from 'assert';

import { Node } from './node';

export class Error extends Node {
  constructor(public readonly code: number, public readonly reason: string) {
    super('error', 'match');

    assert.strictEqual(code, code | 0,
      'The first argument of `.error()` must be an integer error code');
  }

  public otherwise(): this { throw new Error('Not supported'); }
  public skipTo(): this { throw new Error('Not supported'); }
}
