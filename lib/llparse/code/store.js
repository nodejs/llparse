'use strict';

const code = require('./');

class Store extends code.Field {
  constructor(field) {
    super('value', 'store', field);
  }
}
module.exports = Store;
