'use strict';

const ir = require('./');

class Constant extends ir.Base {
  constructor(index, value) {
    super('state:store');

    this.out = false;
    this.index = index;
    this.value = value;
  }

  serialize(reporter) {
    return 'store';
  }
}
module.exports = Constant;
