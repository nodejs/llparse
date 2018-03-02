'use strict';

const code = require('./');

class Load extends code.Field {
  constructor(field) {
    super('match', 'load', field);
  }
}
module.exports = Load;
