'use strict';

const code = require('./');

class Update extends code.Code {
  constructor(name, field, value) {
    super('update', 'match', name);

    this.field = field;
    this.value = value;
    this.cacheKey = `update_${this.field}_${this.numKey(this.value)}`;
  }

  build(ctx, fn) {
    const body = fn.body;
    const field = this.field;
    const value = this.value;

    const { fieldType, returnType } = this.getTypes(ctx, fn, field);

    ctx.store(fn, body, field, fieldType.val(value));
    body.ret(returnType.val(0));
  }
}
module.exports = Update;
