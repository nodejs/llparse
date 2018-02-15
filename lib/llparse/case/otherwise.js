'use strict';

const Case = require('./').Case;

class Otherwise extends Case {
  constructor(next) {
    super('otherwise', next);
  }
}
module.exports = Otherwise;
