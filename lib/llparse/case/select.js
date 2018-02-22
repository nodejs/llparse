'use strict';

const llparse = require('../');

const Case = require('./').Case;

class Select extends Case {
  constructor(next) {
    super('select', next);

    this.map = new Map();
  }

  add(key, value) {
    this.map.set(key, value);
  }

  linearize() {
    const res = [];
    this.map.forEach((value, key) => {
      res.push({
        key: llparse.utils.toBuffer(key),
        next: this.next,
        value,
        noAdvance: false
      });
    });
    return res;
  }
}
module.exports = Select;
