'use strict';

const llparse = require('../');

const Case = require('./').Case;

class Match extends Case {
  constructor(key, next) {
    super('match', next);

    this.key = key;
  }

  linearize() {
    return [ {
      key: llparse.utils.toBuffer(this.key),
      next: this.next,
      value: null
    } ];
  }
}
module.exports = Match;
