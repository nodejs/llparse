'use strict';

const ir = require('./');

class Literal extends ir.Base {
  constructor(ast) {
    super('literal');

    this.ast = ast;
  }
}
module.exports = Literal;
