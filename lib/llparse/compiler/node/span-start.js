'use strict';

const node = require('./');

class SpanStart extends node.Node {
  constructor(name, code) {
    super('span-start', name);

    this.code = code;
  }

  prologue(ctx, body) {
    return body;
  }

  doBuild(ctx, body, nodes) {
    body.comment(`node.SpanStart[${this.code.name}]`);
    body = ctx.compilation.stageResults['span-builder'].spanStart(
      ctx.fn, body, this.code);
    this.doOtherwise(ctx, nodes, body);
  }
}
module.exports = SpanStart;
