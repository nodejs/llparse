'use strict';

const Case = require('./').Case;

class Otherwise extends Case {
  constructor(next, skip = false) {
    super('otherwise', next);
    this.skip = skip;
  }

  linearize() {
    throw new Error('Should not be called');
  }
}
module.exports = Otherwise;
