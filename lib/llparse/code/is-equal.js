'use strict';

const code = require('./');

class IsEqual extends code.FieldValue {
  constructor(field, value) {
    super('match', 'is_equal', field, value);
  }
}
module.exports = IsEqual;
