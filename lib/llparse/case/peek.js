'use strict';

const assert = require('assert');

const llparse = require('../');

const Case = require('./').Case;

class Peek extends Case {
  constructor(key, next) {
    super('peek', next);

    this.key = llparse.utils.toBuffer(key);
    assert.strictEqual(this.key.length, 1,
      '`.peek()` must get exactly 1 byte as a first argument');
  }

  linearize() {
    return [ {
      key: this.key,
      next: this.next,
      value: null,
      noAdvance: true
    } ];
  }
}
module.exports = Peek;
