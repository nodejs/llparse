'use strict';

const node = require('./');

class Empty extends node.Node {
  constructor(name) {
    super('empty', name);
  }

  doBuild(ctx, body, nodes) {
    body.comment('node.Empty');

    this.doOtherwise(ctx, nodes, body);
  }
}
module.exports = Empty;
