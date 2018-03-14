'use strict';

const code = require('./');

class Store extends code.Code {
  constructor(name, field) {
    super('store', 'value', name);

    this.field = field;
    this.cacheKey = `store_${this.field}`;
  }

  build(ctx, fn) {
    const body = fn.body;
    const field = this.field;

    const match = ctx.matchArg(fn);

    const { fieldType, returnType } = this.getTypes(ctx, fn, field);

    const adj = ctx.truncate(body, match, fieldType);

    ctx.store(fn, body, field, adj);
    body.ret(returnType.val(0));
  }
}
module.exports = Store;
