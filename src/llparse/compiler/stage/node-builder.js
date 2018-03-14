'use strict';

const Stage = require('./').Stage;

class NodeBuilder extends Stage {
  constructor(ctx) {
    super(ctx, 'node-builder');

    this.nodes = new Map();
  }

  build() {
    const root = this.ctx.stageResults['node-translator'].root;
    return {
      entry: root.build(this.ctx, this.nodes),
      map: this.nodes
    };
  }
}
module.exports = NodeBuilder;
