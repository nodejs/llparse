import * as assert from 'assert';

import { Node } from './node';

export class Pause extends Node {
  constructor(public readonly code: number, public readonly reason: string) {
    super('pause', 'match');

    assert.strictEqual(code, code | 0,
      'The first argument of `.error()` must be an integer error code');
  }

  public skipTo(): this {
    throw new Error('Not supported, please use `pause.otherwise()`');
  }
}
