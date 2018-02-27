'use strict';

const assert = require('assert');

const Stage = require('./').Stage;
const llparse = require('../../');

const constants = llparse.constants;

const BOOL = constants.BOOL;
const INT = constants.INT;
const TYPE_INPUT = constants.TYPE_INPUT;
const TYPE_OUTPUT = constants.TYPE_OUTPUT;
const TYPE_ERROR = constants.TYPE_ERROR;
const TYPE_REASON = constants.TYPE_REASON;

const SPAN_START_PREFIX = constants.SPAN_START_PREFIX;
const SPAN_CB_PREFIX = constants.SPAN_CB_PREFIX;

class Builder extends Stage {
  constructor(ctx) {
    super(ctx, 'span-builder');
  }

  build() {
    this.buildFields();

    return {
      spanStart: (fn, body, code) => this.buildSpanStart(fn, body, code),
      spanEnd: (fn, body, code) => this.buildSpanEnd(fn, body, code),

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

  // Nodes

  buildSpanStart(fn, body, code) {
    const colors = this.ctx.stageResults['span-allocator'];
    const index = colors.map.get(code);

    const startPtr = this.startField(fn, index);
    body.push(startPtr);

    const store = this.ctx.ir._('store', [ TYPE_INPUT, this.ctx.posArg(fn) ],
      [ TYPE_INPUT.ptr(), startPtr ]);
    store.void();
    body.push(store);

    const num = colors.concurrency[index].length;
    if (num !== 1) {
      const callbackType = this.ctx.signature.callback.span.ptr();

      const cbPtr = this.callbackField(fn, index);
      body.push(cbPtr);

      const store = this.ctx.ir._('store',
        [ callbackType, this.ctx.buildCode(code) ],
        [ callbackType.ptr(), cbPtr ]);
      store.void();
      body.push(store);
    }

    return body;
  }

  buildSpanEnd(fn, body, code) {
    const colors = this.ctx.stageResults['span-allocator'];
    const index = colors.map.get(code);

    const startPtr = this.startField(fn, index);
    body.push(startPtr);

    // Load
    const start = this.ctx.ir._('load', TYPE_INPUT,
      [ TYPE_INPUT.ptr(), startPtr ]);
    body.push(start);

    // ...and reset
    const store = this.ctx.ir._('store', [ TYPE_INPUT, TYPE_INPUT.v(null) ],
      [ TYPE_INPUT.ptr(), startPtr ]);
    store.void();
    body.push(store);

    const signature = this.ctx.signature.callback.span;
    const pos = this.ctx.posArg(fn);

    // TODO(indutny): this won't work with internal callbacks due to
    // cconv mismatch
    const call = this.ctx.call('', signature, this.ctx.buildCode(code), [
      this.ctx.stateArg(fn),
      start,
      pos
    ]);
    body.push(call);

    // Check return value
    const errorCmp = this.ctx.ir._('icmp',
      [ 'eq', signature.ret, call ], [ signature.ret.v(0) ]);
    body.push(errorCmp);

    const errorBranch = body.branch('br', [ BOOL, errorCmp ]);
    const noError = errorBranch.left;
    const error = errorBranch.right;
    noError.name = 'no_error_' + index;
    error.name = 'error_' + index;

    // Handle error
    assert.strictEqual(TYPE_ERROR.type, signature.ret.type);
    this.buildError(fn, error, pos, call);

    return {
      body: noError,
      updateResumptionTarget: (target) => {
        error.comment('store current state');

        const currentPtr = this.ctx.field(fn, '_current');
        error.push(currentPtr);

        error.push(this.ctx.ir._('store',
          [ target.type.ptr(), target.ref() ],
          [ target.type.ptr().ptr(), currentPtr ]).void());

        error.terminate('ret', [ TYPE_OUTPUT, TYPE_OUTPUT.v(null) ]);
      }
    };
  }

  buildError(fn, body, pos, code) {
    body.comment('span error');
    const reason = this.ctx.ir.cstr('Span callback error');

    const cast = this.ctx.ir._('getelementptr inbounds', reason.type.to,
      [ reason.type, reason ], [ INT, INT.v(0) ], [ INT, INT.v(0) ]);
    body.push(cast);

    const codePtr = this.ctx.field(fn, 'error');
    body.push(codePtr);

    const reasonPtr = this.ctx.field(fn, 'reason');
    body.push(reasonPtr);

    const errorPosPtr = this.ctx.field(fn, 'error_pos');
    body.push(errorPosPtr);

    body.push(this.ctx.ir._('store',
      [ TYPE_ERROR, code ],
      [ TYPE_ERROR.ptr(), codePtr ]).void());
    body.push(this.ctx.ir._('store',
      [ TYPE_REASON, cast ],
      [ TYPE_REASON.ptr(), reasonPtr ]).void());
    body.push(this.ctx.ir._('store',
      [ pos.type, pos ],
      [ pos.type.ptr(), errorPosPtr ]).void());
  }

  // ${prefix}_execute

  buildPrologue(fn, body) {
    const colors = this.ctx.stageResults['span-allocator'];

    body.comment('restart spans');

    colors.concurrency.forEach((_, index) => {
      const startPtr = this.startField(fn, index);
      body.push(startPtr);
      const start = this.ctx.ir._('load', TYPE_INPUT,
        [ TYPE_INPUT.ptr(), startPtr ]);
      body.push(start);

      const cmp = this.ctx.ir._('icmp', [ 'eq', TYPE_INPUT, start ],
        [ TYPE_INPUT.v(null) ]);
      body.push(cmp);

      const branch = body.branch('br', [ BOOL, cmp ]);
      const empty = branch.left;
      const restart = branch.right;
      empty.name = 'empty_' + index;
      restart.name = 'restart_' + index;

      const store = this.ctx.ir._('store', [ TYPE_INPUT, this.ctx.posArg(fn) ],
        [ TYPE_INPUT.ptr(), startPtr ]);
      store.void();
      restart.push(store);

      restart.terminate('br', empty);
      body = empty;
    });

    return body;
  }

  buildEpilogue(fn, body) {
    const colors = this.ctx.stageResults['span-allocator'];

    const callbackType = this.ctx.signature.callback.span.ptr();

    body.comment('execute spans');

    colors.concurrency.forEach((list, index) => {
      const codes = list.map(code => this.ctx.buildCode(code));
      const num = codes.length;

      const startPtr = this.startField(fn, index);
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

      let cb;
      if (num === 1) {
        cb = codes[0];
      } else {
        const cbPtr = this.callbackField(fn, index);
        present.push(cbPtr);

        cb = this.ctx.ir._('load', callbackType, [ callbackType.ptr(), cbPtr ]);
        present.push(cb);
      }

      const endPos = this.ctx.endPosArg(fn);

      // TODO(indutny): this won't work with internal callbacks due to
      // cconv mismatch
      const call = this.ctx.call('', callbackType.to, cb, [
        this.ctx.stateArg(fn),
        start,
        endPos
      ]);
      if (num > 1) {
        const callees = codes.map((code) => {
          return code.type.ptr().type + ' @' + code.name;
        }).join(', ');
        call.append([ '!callees', this.ctx.ir.metadata(callees) ]);
      }
      present.push(call);

      // Check return value
      const errorCmp = this.ctx.ir._('icmp',
        [ 'eq', callbackType.to.ret, call ], [ callbackType.to.ret.v(0) ]);
      present.push(errorCmp);

      const errorBranch = present.branch('br', [ BOOL, errorCmp ]);
      const noError = errorBranch.left;
      const error = errorBranch.right;
      noError.name = 'no_error_' + index;
      error.name = 'error_' + index;

      // Make sure that the types match
      assert.strictEqual(fn.type.ret.type, callbackType.to.ret.type);
      this.buildError(fn, error, endPos, call);
      error.terminate('ret', [ fn.type.ret, call ]);

      noError.terminate('br', empty);
      body = empty;
    });

    return body;
  }

  startField(fn, index) {
    return this.ctx.field(fn, SPAN_START_PREFIX + index);
  }

  callbackField(fn, index) {
    return this.ctx.field(fn, SPAN_CB_PREFIX + index);
  }
}
module.exports = Builder;
