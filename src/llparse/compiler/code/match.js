'use strict';

const code = require('./');

class Match extends code.Code {
  constructor(name) {
    super('match', 'match', name);

    this.isExternal = true;
    this.cacheKey = 'external_' + name;
  }

  build() {
    throw new Error('External code can\'t be built');
  }
}
module.exports = Match;
