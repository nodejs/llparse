'use strict';

const node = require('./');

class SpanEnd extends node.Node {
  constructor(name, span) {
    super('span-end', name);

    this.span = span;
  }

  doBuild(ctx, body) {
    body.terminate('unreachable');
  }
}
module.exports = SpanEnd;
