'use strict';

const Stage = require('./').Stage;

class NodeBuilder extends Stage {
  constructor(ctx) {
    super(ctx, 'node-builder');

    this.nodes = new Map();
  }

  build() {
    return this.ctx.stageResults['node-translator'].build(this.ctx, this.nodes);
  }
}
module.exports = NodeBuilder;
