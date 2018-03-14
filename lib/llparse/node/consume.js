'use strict';

const assert = require('assert');

const node = require('./');

const kFieldName = Symbol('fieldName');

class Consume extends node.Node {
  constructor(fieldName) {
    assert.strictEqual(typeof fieldName, 'string',
      'Consume\'s field name must be a string');
    super('consume_' + fieldName, 'match');

    this[kFieldName] = fieldName;
  }

  get fieldName() { return this[kFieldName]; }
}
module.exports = Consume;
