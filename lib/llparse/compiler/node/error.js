'use strict';

const node = require('./');

class Error extends node.Node {
  constructor(id, code, reason) {
    super('error', id);

    this.code = code;
    this.reason = reason;
  }

  getChildren() {
    return [];
  }

  prologue(ctx, body) {
    return body;
  }

  buildStoreError(ctx, body) {
    const INT = ctx.INT;

    const reason = ctx.ir.cstr(this.reason);

    const codePtr = ctx.field('error');
    body.push(codePtr);

    const reasonPtr = ctx.field('reason');
    body.push(reasonPtr);

    const posPtr = ctx.field('error_pos');
    body.push(posPtr);

    const cast = ctx.ir._('getelementptr inbounds', reason.type.to,
      [ reason.type, reason ], [ INT, INT.v(0) ], [ INT, INT.v(0) ]);
    body.push(cast);

    body.push(ctx.ir._('store', [ ctx.TYPE_ERROR, ctx.TYPE_ERROR.v(this.code) ],
      [ ctx.TYPE_ERROR.ptr(), codePtr ]).void());
    body.push(ctx.ir._('store', [ ctx.TYPE_REASON, cast ],
      [ ctx.TYPE_REASON.ptr(), reasonPtr ]).void());
    body.push(ctx.ir._('store', [ ctx.pos.current.type, ctx.pos.current ],
      [ ctx.pos.current.type.ptr(), posPtr ]).void());

    return body;
  }

  doBuild(ctx, body) {
    body.comment('node.Error');

    body = this.buildStoreError(ctx, body);

    body.comment('state.current = null');
    const currentPtr = ctx.field('_current');
    body.push(currentPtr);

    // Non-recoverable state
    const nodeSig = ctx.compilation.signature.node;
    body.push(ctx.ir._('store', [ nodeSig.ptr(), nodeSig.ptr().v(null) ],
      [ nodeSig.ptr().ptr(), currentPtr ]).void());

    const retType = ctx.fn.type.ret;
    body.terminate('ret', [ retType, retType.v(null) ]);
  }
}
module.exports = Error;
