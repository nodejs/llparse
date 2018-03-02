'use strict';

const assert = require('assert');

const code = require('./');

const kOptions = Symbol('options');

class MulAdd extends code.Field {
  constructor(field, options) {
    super('value', 'mul_add', field);

    options = Object.assign({
      max: 0,
      signed: true
    }, options);
    assert.strictEqual(typeof options.max, 'number',
      '`MulAdd.options.max` must be a number');
    assert.strictEqual(typeof options.base, 'number',
      '`MulAdd.options.base` must be a number');
    assert(options.max >= 0,
      '`MulAdd.options.max` must be a non-negative number');
    assert(options.base > 0,
      '`MulAdd.options.base` must be a positive number');
    assert.strictEqual(options.max, options.max | 0,
      '`MulAdd.options.max` must be an integer');
    assert.strictEqual(options.base, options.base | 0,
      '`MulAdd.options.max` must be an integer');

    this[kOptions] = options;
  }

  get options() { return this[kOptions]; }
}
module.exports = MulAdd;
