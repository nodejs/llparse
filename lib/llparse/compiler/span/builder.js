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
    this.buildFields();

    return {
      postExecute: (fn, body) => this.buildEpilogue(fn, body)
    };
  }

  buildFields() {
    const colors = this.ctx.stageResults['span-allocator'];

    const callbackType = this.ctx.signature.callback.span.ptr();

    colors.concurrency.forEach((list, index) => {
      const num = list.length;
      this.ctx.declareField(TYPE_INPUT, SPAN_START_PREFIX + index,
        type => type.v(null));

      if (num === 1)
        return;

      this.ctx.declareField(callbackType, SPAN_CB_PREFIX + index,
        type => type.v(null));
    });
  }

  buildEpilogue(fn, body) {
    const colors = this.ctx.stageResults['span-allocator'];

    const callbackType = this.ctx.signature.callback.span.ptr();

    body.comment('execute spans');

    colors.concurrency.forEach((list, index) => {
      const num = list.length;

      const startPtr = this.ctx.field(fn, SPAN_START_PREFIX + index);

      // TODO(indutny): branch and call

      let cb;
      if (num === 1) {
        cb = this.ctx.buildCode(list[0]);
      } else {
        const cbPtr = this.ctx.field(fn, SPAN_CB_PREFIX + index);
        body.push(cbPtr);

        cb = this.ctx.ir._('load', callbackType, [ callbackType.ptr(), cbPtr ]);
        body.push(cb);
      }
    });

    return body;
  }
}
module.exports = Builder;
