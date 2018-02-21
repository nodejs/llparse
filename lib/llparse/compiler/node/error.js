'use strict';

const IR = require('llvm-ir');

const node = require('./');

class Error extends node.Node {
  constructor(name, code, reason) {
    super('error', name);

    this.code = code;
    this.reason = reason;
  }

  prologue(ctx, fn) {
    return fn.body;
  }

  doBuild(ctx, fn, body) {
    const reason = ctx.ir.cstr(this.reason);

    const codePtr = ctx.field(fn, 'error');
    body.push(codePtr);

    const reasonPtr = ctx.field(fn, 'reason');
    body.push(reasonPtr);

    const castReason = IR._('bitcast', [
      reason.type, reason, 'to', ctx.TYPE_REASON
    ]);
    body.push(castReason);

    body.push(IR._('store', [ ctx.TYPE_ERROR, ctx.TYPE_ERROR.v(code) ],
      [ ctx.TYPE_ERROR.ptr(), codeField ]).void());
    body.push(IR._('store', [ ctx.TYPE_REASON, castReason ],
      [ ctx.TYPE_REASON.ptr(), reasonField ]).void());

    body.terminate('ret', [ fn.ret.type, fn.ret.type.v(null) ]);
  }
}
module.exports = Error;
