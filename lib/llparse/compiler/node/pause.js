'use strict';

const node = require('./');

class Pause extends node.Error {
  constructor(id, code, reason) {
    super(id, code, reason);
    this.type = 'pause';
  }

  getResumptionTargets() {
    return super.getResumptionTargets().concat(this.otherwise);
  }

  doBuild(ctx, body) {
    body = this.buildStoreError(ctx, body);

    const currentPtr = ctx.stateField(body, '_current');

    // Recoverable state
    const target = this.buildNode(ctx, this.otherwise);
    body.store(target, currentPtr);

    body.ret(ctx.fn.ty.toSignature().returnType.val(null));
  }
}
module.exports = Pause;
