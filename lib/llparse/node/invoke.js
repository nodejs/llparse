'use strict';

const assert = require('assert');

const node = require('./');
const llparse = require('../');

const kNoAdvance = llparse.symbols.kNoAdvance;
const kType = llparse.symbols.kType;
const kCode = Symbol('code');
const kMap = Symbol('map');

class Invoke extends node.Node {
  constructor(code, map = {}, otherwise = null) {
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

    this[kNoAdvance] = true;
  }

  get code() { return this[kCode]; }
  get map() { return this[kMap]; }

  match() { throw new Error('Not supported'); }
  select() { throw new Error('Not supported'); }
}
module.exports = Invoke;
