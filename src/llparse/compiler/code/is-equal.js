'use strict';

const code = require('./');

class IsEqual extends code.Code {
  constructor(name, field, value) {
    super('is-equal', 'match', name);

    this.field = field;
    this.value = value;
    this.cacheKey = `is_equal_${this.field}_${this.numKey(this.value)}`;
  }

  build(ctx, fn) {
    const body = fn.body;
    const field = this.field;
    const value = this.value;

    const { fieldType, returnType } = this.getTypes(ctx, fn, field);
    const fieldValue = ctx.load(fn, body, field);

    const cmp = body.icmp('eq', fieldValue, fieldType.val(value));
    body.ret(ctx.truncate(body, cmp, returnType));
  }
}
module.exports = IsEqual;
