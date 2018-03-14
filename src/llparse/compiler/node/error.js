'use strict';

const node = require('./');

class Error extends node.Node {
  constructor(id, code, reason) {
    super('error', id);

    this.code = code;
    this.reason = reason;
    this.noPrologueCheck = true;
  }

  getChildren() {
    return [];
  }

  buildStoreError(ctx, body) {
    const INT = ctx.INT;

    const reason = ctx.cstring(this.reason);

    const codePtr = ctx.stateField(body, 'error');
    const reasonPtr = ctx.stateField(body, 'reason');
    const posPtr = ctx.stateField(body, 'error_pos');

    const cast = body.getelementptr(reason, INT.val(0), INT.val(0), true);

    body.store(ctx.TYPE_ERROR.val(this.code), codePtr);
    body.store(cast, reasonPtr);
    body.store(ctx.pos.current, posPtr);

    return body;
  }

  doBuild(ctx, body) {
    body = this.buildStoreError(ctx, body);

    const currentPtr = ctx.stateField(body, '_current');

    // Non-recoverable state
    const nodeSig = ctx.compilation.signature.node;
    body.store(nodeSig.ptr().val(null), currentPtr);

    const retType = ctx.fn.ty.toSignature().returnType;
    body.ret(retType.val(null));
  }
}
module.exports = Error;
