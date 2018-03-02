'use strict';

const code = require('./');

class Test extends code.FieldValue {
  constructor(field, mask) {
    super('match', 'test', field, mask);
  }
}
module.exports = Test;
