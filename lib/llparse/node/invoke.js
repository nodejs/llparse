'use strict';

const assert = require('assert');

const node = require('./');
const llparse = require('../');

const kNoAdvance = llparse.symbols.kNoAdvance;
const kCallback = Symbol('callback');
const kMap = Symbol('map');

class Invoke extends node.Node {
  constructor(callback, map, otherwise) {
    assert.strictEqual(typeof map, 'object',
      'Invalid `map` argument of `.invoke()`');
    assert(otherwise instanceof node.Node,
      'Invalid `otherwise` argument of `.invoke()`');
    assert.strictEqual(typeof callback, 'string',
      'Invalid `callback` argument of `.invoke()`');

    super('invoke_' + callback);

    this[kCallback] = callback;

    // TODO(indutny): validate that keys are integers
    this[kMap] = map;

    this.otherwise(otherwise);

    this[kNoAdvance] = true;
  }

  get callback() { return this[kCallback]; }
  get map() { return this[kMap]; }
}
module.exports = Invoke;
