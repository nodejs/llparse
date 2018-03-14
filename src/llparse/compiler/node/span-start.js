'use strict';

const node = require('./');

class SpanStart extends node.Node {
  constructor(id, code) {
    super('span-start', id);

    this.code = code;
    this.noPrologueCheck = true;
  }

  doBuild(ctx, body) {
    body = ctx.compilation.stageResults['span-builder'].spanStart(
      ctx.fn, body, this.code);
    this.doOtherwise(ctx, body);
  }
}
module.exports = SpanStart;
