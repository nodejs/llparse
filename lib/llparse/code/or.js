'use strict';

const code = require('./');

class Or extends code.FieldValue {
  constructor(field, value) {
    super('match', 'or', field, value);
  }
}
module.exports = Or;
