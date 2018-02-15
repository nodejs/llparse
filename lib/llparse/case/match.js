'use strict';

const Case = require('./').Case;

class Match extends Case {
  constructor(value, next) {
    super('match', next);

    this.value = value;
  }
}
module.exports = Match;
