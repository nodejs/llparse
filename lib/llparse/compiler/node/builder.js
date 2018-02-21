'use strict';

const compiler = require('../');

class NodeBuilder extends compiler.Stage {
  constructor(ctx) {
    super(ctx, 'node-builder');

    this.nodes = new Map();
  }

  build() {
    return this.ctx.stageResults['node-translator'].build(this.ctx, this.nodes);
  }
}
module.exports = NodeBuilder;
