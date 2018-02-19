'use strict';

const llparse = require('../');

const Case = require('./').Case;

class Select extends Case {
  constructor(map, next) {
    super('select', next);

    this.map = map;
  }

  linearize() {
    return Object.keys(this.map).map((key) => {
      return {
        key: llparse.utils.toBuffer(key),
        next: this.next,
        value: this.map[key]
      };
    });
  }
}
module.exports = Select;
