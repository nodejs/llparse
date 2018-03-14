'use strict';

const node = require('./');

class Empty extends node.Node {
  constructor(...args) {
    super('empty', ...args);
  }

  prologue(ctx, body) {
    if (this.skip)
      return super.prologue(ctx, body);
    return body;
  }

  doBuild(ctx, body) {
    this.doOtherwise(ctx, body);
  }
}
module.exports = Empty;
