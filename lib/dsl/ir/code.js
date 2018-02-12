'use strict';

const ir = require('./');

class Code extends ir.Base {
  constructor(ast) {
    super('code');

    this.out = false;

    this.ast = ast;
  }

  build(builder) {
    return builder.build(this.ast);
  }
}
module.exports = Code;
