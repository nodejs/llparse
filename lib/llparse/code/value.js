'use strict';

const code = require('./');

class Value extends code.Code {
  constructor(name, body) {
    super('value', name, body);
  }
}
module.exports = Value;
