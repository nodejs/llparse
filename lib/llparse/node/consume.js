'use strict';

const assert = require('assert');

const node = require('./');
const llparse = require('../');

const kType = llparse.symbols.kType;
const kCode = llparse.symbols.kCode;

class Consume extends node.Node {
  constructor(code) {
    assert(code instanceof llparse.code.Code,
      'Invalid `code` argument of `.consume()`, must be a Code instance');
    assert.strictEqual(code[kType], 'match',
      '`code` argument of `.consume()` must be have a `match` type');

    super('consume_' + code.name, 'match');

    this[kCode] = code;
  }
}
module.exports = Consume;
