'use strict';

const Case = require('./').Case;

class Select extends Case {
  constructor(map, next) {
    super('select', next);

    this.map = map;
  }
}
module.exports = Select;
