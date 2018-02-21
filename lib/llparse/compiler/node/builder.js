'use strict';

const assert = require('assert');

const compiler = require('../');
const llparse = require('../../');

const kCases = llparse.symbols.kCases;
const kCode = llparse.symbols.kCode;
const kMap = llparse.symbols.kMap;
const kOtherwise = llparse.symbols.kOtherwise;
const kSignature = llparse.symbols.kSignature;
const kSpan = llparse.symbols.kSpan;

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
