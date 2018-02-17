'use strict';

const assert = require('assert');

const llparse = require('./');

class Invoke extends llparse.Node {
  constructor(callback, map, otherwise) {
    assert.strictEqual(typeof map, 'object',
      'Invalid `map` argument of `.invoke()`');
    assert(otherwise instanceof llparse.Node,
      'Invalid `otherwise` argument of `.invoke()`');
    super('invoke_' + callback);

    this.callback = callback;

    // TODO(indutny): validate that keys are integers
    this.map = map;

    this.otherwise(otherwise);

    this.noAdvance = true;
  }
}
module.exports = Invoke;
