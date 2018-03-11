'use strict';

const assert = require('assert');

const Stage = require('./').Stage;
const llparse = require('../../');

const constants = llparse.constants;

const INT = constants.INT;
const TYPE_INPUT = constants.TYPE_INPUT;
const TYPE_OUTPUT = constants.TYPE_OUTPUT;
const TYPE_ERROR = constants.TYPE_ERROR;

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
        type => type.val(null));

      if (num === 1)
        return;

      this.ctx.declareField(callbackType, SPAN_CB_PREFIX + index,
        type => type.val(null));
    });
  }

  // Nodes

  buildSpanStart(fn, body, code) {
    const colors = this.ctx.stageResults['span-allocator'];
    const index = colors.map.get(code);

    const startPtr = this.startField(fn, body, index);

    body.store(this.ctx.posArg(fn), startPtr);

    const num = colors.concurrency[index].length;
    if (num !== 1) {
      const cbPtr = this.callbackField(fn, body, index);
      body.store(this.ctx.buildCode(code), cbPtr);
    }

    return body;
  }

  buildSpanEnd(fn, body, code) {
    const colors = this.ctx.stageResults['span-allocator'];
    const index = colors.map.get(code);

    const startPtr = this.startField(fn, body, index);

    // Load
    const start = body.load(startPtr);

    // ...and reset
    body.store(TYPE_INPUT.val(null), startPtr);

    const signature = this.ctx.signature.callback.span;
    const pos = this.ctx.posArg(fn);

    // TODO(indutny): this won't work with internal callbacks due to
    // cconv mismatch
    const call = body.call(this.ctx.buildCode(code), [
      this.ctx.stateArg(fn),
      start,
      pos
    ]);

    // Check return value
    const errorCmp = body.icmp('eq', call, signature.returnType.val(0));

    const errorBranch = this.ctx.branch(body, errorCmp,
      [ 'likely', 'unlikely' ]);
    const noError = errorBranch.left;
    const error = errorBranch.right;
    noError.name = 'no_error_' + index;
    error.name = 'error_' + index;

    // Handle error
    assert(TYPE_ERROR.isEqual(signature.returnType));
    this.buildError(fn, error, pos, call);

    return {
      body: noError,
      updateResumptionTarget: (target) => {
        const currentPtr = this.ctx.stateField(fn, error, '_current');

        error.store(target, currentPtr);
        error.ret(TYPE_OUTPUT.val(null));
      }
    };
  }

  buildError(fn, body, pos, code) {
    const reason = this.ctx.cstring('Span callback error');

    const cast = body.getelementptr(reason, INT.val(0), INT.val(0), true);
    const codePtr = this.ctx.stateField(fn, body, 'error');
    const reasonPtr = this.ctx.stateField(fn, body, 'reason');
    const errorPosPtr = this.ctx.stateField(fn, body, 'error_pos');

    body.store(code, codePtr);
    body.store(cast, reasonPtr);
    body.store(pos, errorPosPtr);
  }

  // ${prefix}_execute

  buildPrologue(fn, body) {
    const colors = this.ctx.stageResults['span-allocator'];

    colors.concurrency.forEach((_, index) => {
      const startPtr = this.startField(fn, body, index);
      const start = body.load(startPtr);

      const cmp = body.icmp('eq', start, TYPE_INPUT.val(null));

      const branch = this.ctx.branch(body, cmp);
      const empty = branch.left;
      const restart = branch.right;
      empty.name = 'empty_' + index;
      restart.name = 'restart_' + index;

      restart.store(this.ctx.posArg(fn), startPtr);

      restart.jmp(empty);
      body = empty;
    });

    return body;
  }

  buildEpilogue(fn, body) {
    const colors = this.ctx.stageResults['span-allocator'];

    const callbackType = this.ctx.signature.callback.span.ptr();

    colors.concurrency.forEach((list, index) => {
      const codes = list.map(code => this.ctx.buildCode(code));
      const num = codes.length;

      const startPtr = this.startField(fn, body, index);
      const start = body.load(startPtr);

      const cmp = body.icmp('ne', start, TYPE_INPUT.val(null));

      const branch = this.ctx.branch(body, cmp);
      const present = branch.left;
      const empty = branch.right;
      present.name = 'present_' + index;
      empty.name = 'empty_' + index;

      let cb;
      if (num === 1) {
        cb = codes[0];
      } else {
        const cbPtr = this.callbackField(fn, present, index);
        cb = present.load(cbPtr);
      }

      const endPos = this.ctx.endPosArg(fn);

      // TODO(indutny): this won't work with internal callbacks due to
      // cconv mismatch
      const call = present.call(cb, [
        this.ctx.stateArg(fn),
        start,
        endPos
      ], 'normal', 'ccc');
      if (num > 1) {
        const callees = codes.map((code) => {
          return this.ctx.ir.metadata(code);
        });
        call.metadata.set('callees', this.ctx.ir.metadata(callees));
      }

      // Check return value
      const errorCmp = present.icmp('eq', call,
        callbackType.to.toSignature().returnType.val(0));

      const errorBranch = this.ctx.branch(present, errorCmp,
        [ 'likely', 'unlikely' ]);
      const noError = errorBranch.left;
      const error = errorBranch.right;
      noError.name = 'no_error_' + index;
      error.name = 'error_' + index;

      // Make sure that the types match
      assert(fn.ty.toSignature().returnType.isEqual(
        callbackType.toPointer().to.toSignature().returnType));
      this.buildError(fn, error, endPos, call);
      error.ret(call);

      noError.jmp(empty);
      body = empty;
    });

    return body;
  }

  startField(fn, body, index) {
    return this.ctx.stateField(fn, body, SPAN_START_PREFIX + index);
  }

  callbackField(fn, body, index) {
    return this.ctx.stateField(fn, body, SPAN_CB_PREFIX + index);
  }
}
module.exports = Builder;
