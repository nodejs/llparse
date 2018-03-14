'use strict';

const code = require('./');

class Value extends code.Code {
  constructor(name) {
    super('value', 'value', name);

    this.isExternal = true;
    this.cacheKey = 'external_' + name;
  }

  build() {
    throw new Error('External code can\'t be built');
  }
}
module.exports = Value;
