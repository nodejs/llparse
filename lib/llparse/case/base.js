'use strict';

class Case {
  constructor(type, next) {
    this.type = type;
    this.next = next;
  }

  linearize() {
    throw new Error('Not implemented');
  }
}
module.exports = Case;
