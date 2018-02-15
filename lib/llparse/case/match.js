'use strict';

const Buffer = require('buffer').Buffer;

const Case = require('./').Case;

class Match extends Case {
  constructor(key, next) {
    super('match', next);

    this.key = key;
  }

  linearize() {
    return [ { key: Buffer.from(this.key), next: this.next, value: null } ];
  }
}
module.exports = Match;
