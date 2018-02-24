'use strict';

const assert = require('assert');

const node = require('./');
const llparse = require('../');

const kType = llparse.symbols.kType;
const kCode = llparse.symbols.kCode;
const kMap = llparse.symbols.kMap;

class Invoke extends node.Node {
  constructor(code, map, otherwise = null) {
    // `.invoke(code, otherwise)`
    if (map && map instanceof node.Node) {
      otherwise = map;
      map = null;
    }

    map = map || {};

    assert.strictEqual(typeof map, 'object',
      'Invalid `map` argument of `.invoke()`, must be an Object');
    assert(code instanceof llparse.code.Code,
      'Invalid `code` argument of `.invoke()`, must be a Code instance');

    Object.keys(map).forEach((key) => {
      assert.equal(key, key | 0,
        'Only integer keys are allowed in `.invoke()`\'s map');
    });

    super('invoke_' + code.name, code[kType]);

    this[kCode] = code;
    this[kMap] = map;

    if (otherwise)
      this.otherwise(otherwise);
  }
}
module.exports = Invoke;
