'use strict';

const code = require('./');

class Update extends code.FieldValue {
  constructor(field, value) {
    super('match', 'update', field, value);
  }
}
module.exports = Update;
