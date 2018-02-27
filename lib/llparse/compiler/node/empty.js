'use strict';

const node = require('./');

class Empty extends node.Node {
  constructor(...args) {
    super('empty', ...args);
  }

  doBuild(ctx, body) {
    body.comment('node.Empty');

    this.doOtherwise(ctx, body);
  }
}
module.exports = Empty;
