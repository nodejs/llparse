'use strict';

const node = require('./');

class SpanEnd extends node.Node {
  constructor(id, code) {
    super('span-end', id);

    this.code = code;
    this.noPrologueCheck = true;
  }

  getResumptionTargets() {
    return super.getResumptionTargets().concat(this.otherwise);
  }

  doBuild(ctx, body) {
    body.comment(`node.SpanEnd[${this.code.name}]`);
    const result = ctx.compilation.stageResults['span-builder'].spanEnd(
      ctx.fn, body, this.code);

    result.updateResumptionTarget(this.doOtherwise(ctx, result.body));
  }
}
module.exports = SpanEnd;
