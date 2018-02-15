'use strict';

const Case = require('./').Case;

class Otherwise extends Case {
  constructor(next) {
    super('otherwise', next);
  }

  linearize() {
    return [];
  }
}
module.exports = Otherwise;
