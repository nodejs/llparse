'use strict';

const node = require('./');

class SpanStart extends node.Node {
  constructor(name, span) {
    super('span-start', name);

    this.span = span;
  }

  doBuild(ctx, body) {
    body.terminate('unreachable');
  }
}
module.exports = SpanStart;
