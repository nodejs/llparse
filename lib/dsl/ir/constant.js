'use strict';

const ir = require('./');

class Constant extends ir.Base {
  constructor(ast) {
    super('constant');

    this.out = false;
    this.ast = ast;
  }
}
module.exports = Constant;
