'use strict';

const node = require('./');

class Empty extends node.Node {
  constructor(...args) {
    super('empty', ...args);
  }

  doBuild(ctx, body) {
    this.doOtherwise(ctx, body);
  }
}
module.exports = Empty;
