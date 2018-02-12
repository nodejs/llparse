'use strict';

const ir = require('./');

class Intrinsic extends ir.Base {
  constructor(name, args) {
    super('intrinsic');

    this.name = name;
    this.args = args;

    if (name !== 'match')
      this.out = false;
  }

  build(builder) {
    return builder.build(this.ast);
  }
}
module.exports = Intrinsic;
