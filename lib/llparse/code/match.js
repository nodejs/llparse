'use strict';

const code = require('./');

class Match extends code.Code {
  constructor(name) {
    super('match', name);
  }
}
module.exports = Match;
