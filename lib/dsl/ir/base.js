'use strict';

class Base {
  constructor(type) {
    this.type = type;
    this.ast = null;

    this.out = null;
    this.tmp = false;

    this.terminal = false;
  }
}
module.exports = Base;
