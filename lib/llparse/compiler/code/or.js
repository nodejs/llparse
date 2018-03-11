'use strict';

const code = require('./');

class Or extends code.Code {
  constructor(name, field, value) {
    super('or', 'match', name);

    this.field = field;
    this.value = value;
    this.cacheKey = `or_${this.field}_${this.numKey(this.value)}`;
  }

  build(ctx, fn) {
    const body = fn.body;
    const field = this.field;
    const value = this.value;

    const { fieldType, returnType } = this.getTypes(ctx, fn, field);

    const current = ctx.load(fn, body, field);
    const result = body.binop('or', current, fieldType.val(value));
    ctx.store(fn, body, field, result);
    body.ret(returnType.val(0));
  }
}
module.exports = Or;
