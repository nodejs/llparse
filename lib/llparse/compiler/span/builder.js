'use strict';

const llparse = require('../../');
const compiler = require('../');

const constants = llparse.constants;

const SPAN_START_PREFIX = constants.SPAN_START_PREFIX;
const SPAN_CB_PREFIX = constants.SPAN_CB_PREFIX;


class Builder extends compiler.Stage {
  constructor(ctx) {
    super(ctx, 'span-builder');
  }

  build() {
    // TODO(indutny): implement me
  }

  buildSpanFields() {
    const allocator = new llparse.span.Allocator();

    const colors = allocator.execute(this.ctx.root);

    colors.concurrency.forEach((num, index) => {
      this.state.field(TYPE_INPUT, SPAN_START_PREFIX + index);

      // TODO(indutny): use smaller field size if possible?
      if (num === 1)
        return;

      this.state.field(this.signature.callback.match.ptr(),
        SPAN_CB_PREFIX + index);
    });
    console.log(colors);
  }
}
module.exports = Builder;
