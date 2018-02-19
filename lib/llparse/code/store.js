'use strict';

const code = require('./');

class Store extends code.Code {
  constructor(name, body) {
    super('value', name, body);
  }
}
module.exports = Store;
