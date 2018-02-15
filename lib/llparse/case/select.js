'use strict';

const Case = require('./').Case;

class Select extends Case {
  constructor(map, next) {
    super('select', next);

    this.map = map;
  }

  linearize() {
    return Object.keys(this.map).map((key) => {
      return { key: Buffer.from(key), next: this.next, value: this.map[key] };
    });
  }
}
module.exports = Select;
