'use strict';

const ir = require('./');

class Constant extends ir.Base {
  constructor(ast) {
    super('constant');

    this.out = false;
    this.ast = ast;

    this.value = this.ast.value;
  }

  serialize(reporter) {
    if (typeof this.value === 'number')
      return `i64 ${this.value | 0}`;

    return `c${JSON.stringify(this.value)}`;
  }
}
module.exports = Constant;
