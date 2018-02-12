'use strict';

const ir = require('./');

class Constant extends ir.Base {
  constructor(ast) {
    super('constant');

    this.out = false;
    this.ast = ast;
  }

  serialize(reporter) {
    if (typeof this.ast.value === 'number')
      return `i64 ${this.ast.value | 0}`;

    return `c${JSON.stringify(this.ast.value)}`;
  }
}
module.exports = Constant;
