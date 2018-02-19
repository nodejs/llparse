'use strict';

const code = require('./');

class Store extends code.Code {
  constructor(name, body) {
    super('store', name, body);
  }
}
module.exports = Store;
