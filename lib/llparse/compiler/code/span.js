'use strict';

const code = require('./');

class Span extends code.Code {
  constructor(name) {
    super('span', 'match', name);

    this.isExternal = true;
    this.cacheKey = 'external_' + name;
  }

  build() {
    throw new Error('External code can\'t be built');
  }
}
module.exports = Span;
