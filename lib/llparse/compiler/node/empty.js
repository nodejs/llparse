'use strict';

const node = require('./');

class Empty extends node.Node {
  constructor(...args) {
    super('empty', ...args);
  }

  doBuild(ctx, body, nodes) {
    body.comment('node.Empty');

    this.doOtherwise(ctx, nodes, body);
  }
}
module.exports = Empty;
