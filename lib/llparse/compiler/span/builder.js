'use strict';

const llparse = require('../../');
const compiler = require('../');

const constants = llparse.constants;

const BOOL = constants.BOOL;
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
      preExecute: (fn, body) => this.buildPrologue(fn, body),
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

  buildPrologue(fn, body) {
    return body;
  }

  buildEpilogue(fn, body) {
    const colors = this.ctx.stageResults['span-allocator'];

    const callbackType = this.ctx.signature.callback.span.ptr();

    body.comment('execute spans');

    colors.concurrency.forEach((list, index) => {
      const num = list.length;

      const startPtr = this.ctx.field(fn, SPAN_START_PREFIX + index);
      body.push(startPtr);
      const start = this.ctx.ir._('load', TYPE_INPUT,
        [ TYPE_INPUT.ptr(), startPtr ]);
      body.push(start);

      const cmp = this.ctx.ir._('icmp', [ 'ne', TYPE_INPUT, start ],
        TYPE_INPUT.v(null));
      body.push(cmp);

      const branch = body.branch('br', [ BOOL, cmp ]);
      const present = branch.left;
      const empty = branch.right;
      present.name = 'present_' + index;
      empty.name = 'empty_' + index;

      // TODO(indutny): branch and call

      let cb;
      if (num === 1) {
        cb = this.ctx.buildCode(list[0]);
      } else {
        const cbPtr = this.ctx.field(fn, SPAN_CB_PREFIX + index);
        present.push(cbPtr);

        cb = this.ctx.ir._('load', callbackType, [ callbackType.ptr(), cbPtr ]);
        present.push(cb);
      }

      // TODO(indutny): this won't work with internal callbacks due to
      // cconv mismatch
      const call = this.ctx.call('', callbackType.to, cb, [
        this.ctx.stateArg(fn),
        start,
        this.ctx.endPosArg(fn)
      ]);
      present.push(call);

      present.terminate('br', empty);
      body = empty;
    });

    return body;
  }
}
module.exports = Builder;
