'use strict';

const node = require('./');

class Pause extends node.Error {
  constructor(id, code, reason) {
    super(id, code, reason);
    this.type = 'pause';
  }

  doBuild(ctx, body) {
    body.comment('node.Pause');

    body = this.buildStoreError(ctx, body);

    body.comment('state.current = next');
    const currentPtr = ctx.field('_current');
    body.push(currentPtr);

    // Recoverable state
    const target = this.buildNode(ctx, this.otherwise);
    body.push(ctx.ir._('store', [ target.type.ptr(), target.ref() ],
      [ target.type.ptr().ptr(), currentPtr ]).void());

    const retType = ctx.fn.type.ret;
    body.terminate('ret', [ retType, retType.v(null) ]);
  }
}
module.exports = Pause;
