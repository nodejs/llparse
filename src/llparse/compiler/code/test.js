'use strict';

const code = require('./');

class Test extends code.Code {
  constructor(name, field, value) {
    super('test', 'match', name);

    this.field = field;
    this.value = value;
    this.cacheKey = `test_${this.field}_${this.numKey(this.value)}`;
  }

  build(ctx, fn) {
    const body = fn.body;
    const field = this.field;
    const value = this.value;

    const { fieldType, returnType } = this.getTypes(ctx, fn, field);

    const current = ctx.load(fn, body, field);

    const masked = body.binop('and', current, fieldType.val(value));
    const bool = body.icmp('eq', masked, fieldType.val(value));

    body.ret(ctx.truncate(body, bool, returnType));
  }
}
module.exports = Test;
