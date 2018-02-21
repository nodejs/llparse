'use strict';

const compiler = require('./');
const llparse = require('../');

class NodeBuilder extends compiler.Stage {
  constructor(ctx) {
    super(ctx, 'node-builder');
  }

  build() {
  }
}
module.exports = NodeBuilder;
