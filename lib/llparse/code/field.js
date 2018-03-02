'use strict';

const code = require('./');

const kField = Symbol('field');

class Field extends code.Code {
  constructor(signature, name, field) {
    super(signature, name + '_' + field);

    this[kField] = field;
  }

  get field() { return this[kField]; }
}
module.exports = Field;
