'use strict';

const assert = require('assert');

const node = require('./');

const kCode = Symbol('code');
const kReason = Symbol('reason');

class Pause extends node.Node {
  constructor(code, reason) {
    super('pause', 'match');

    assert.strictEqual(typeof code, 'number',
      'The first argument of `.error()` must be a numeric error code');
    assert.strictEqual(code, code | 0,
      'The first argument of `.error()` must be an integer error code');
    assert.strictEqual(typeof reason, 'string',
      'The second argument of `.error()` must be a string error description');

    this[kCode] = code;
    this[kReason] = reason;
  }

  get code() { return this[kCode]; }
  get reason() { return this[kReason]; }

  skipTo() { throw new Error('Not supported, please use `pause.otherwise()`'); }
}
module.exports = Pause;
