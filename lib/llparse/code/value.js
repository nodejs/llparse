'use strict';

const code = require('./');

class Value extends code.Code {
  constructor(name) {
    super('value', name);
  }
}
module.exports = Value;
