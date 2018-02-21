'use strict';

const llparse = require('../../');
const compiler = require('../');

const constants = llparse.constants;

const TYPE_INPUT = constants.TYPE_INPUT;

const SPAN_START_PREFIX = constants.SPAN_START_PREFIX;
const SPAN_CB_PREFIX = constants.SPAN_CB_PREFIX;

class Builder extends compiler.Stage {
  constructor(ctx) {
    super(ctx, 'span-builder');
  }

  build() {
    // TODO(indutny): implement me
    this.buildFields();
  }

  buildFields() {
    const colors = this.ctx.stageResults['span-allocator'];

    const callbackType = this.ctx.signature.callback.span.ptr();

    colors.concurrency.forEach((num, index) => {
      this.ctx.declareField(TYPE_INPUT, SPAN_START_PREFIX + index,
        type => type.v(null));

      // TODO(indutny): use smaller field size if possible?
      if (num === 1)
        return;

      this.ctx.declareField(callbackType, SPAN_CB_PREFIX + index,
        type => type.v(null));
    });
  }
}
module.exports = Builder;
