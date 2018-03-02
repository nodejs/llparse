'use strict';

const assert = require('assert');

const node = require('./');
const llparse = require('../');

const kSignature = llparse.symbols.kSignature;
const kCode = llparse.symbols.kCode;

class Consume extends node.Node {
  constructor(code) {
    assert(code instanceof llparse.code.Code,
      'Invalid `code` argument of `.consume()`, must be a Code instance');
    assert.strictEqual(code[kSignature], 'match',
      '`code` argument of `.consume()` must be have a `match` type');

    super('consume_' + code.name, 'match');

    this[kCode] = code;
  }
}
module.exports = Consume;
