'use strict';

const node = require('./');

class SpanEnd extends node.Node {
  constructor(id, code) {
    super('span-end', id);

    this.code = code;
  }

  prologue(ctx, body) {
    return body;
  }

  doBuild(ctx, body, nodes) {
    body.comment(`node.SpanEnd[${this.code.name}]`);
    body = ctx.compilation.stageResults['span-builder'].spanEnd(
      ctx.fn, body, this.code);
    this.doOtherwise(ctx, nodes, body);
  }
}
module.exports = SpanEnd;
