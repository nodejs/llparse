'use strict';

const code = require('./');

class Match extends code.Code {
  constructor(name, body) {
    super('match', name, body);
  }
}
module.exports = Match;
