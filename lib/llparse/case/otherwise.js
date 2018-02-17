'use strict';

const Case = require('./').Case;

class Otherwise extends Case {
  constructor(next, skip = false) {
    super('otherwise', next);
    this.skip = skip;
  }

  linearize() {
    return [];
  }
}
module.exports = Otherwise;
