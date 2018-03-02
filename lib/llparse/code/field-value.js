'use strict';

const assert = require('assert');

const code = require('./');

const kValue = Symbol('value');

class FieldValue extends code.Field {
  constructor(signature, name, field, value) {
    super(signature, name, field);

    assert.strictEqual(typeof value, 'number',
      '`value` argument must be a number');
    assert.strictEqual(value, value | 0, '`value` argument must be an integer');

    this[kValue] = value;
  }

  get value() { return this[kValue]; }
}
module.exports = FieldValue;
