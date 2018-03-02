'use strict';

const assert = require('assert');

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

    // TODO(indutny): de-duplicate
    const stateType = ctx.state;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    const current = ctx.load(fn, body, field);
    const result = ctx.ir._('or', [ fieldType, current ],
      fieldType.v(value));
    body.push(result);

    ctx.store(fn, body, field, result);
    body.terminate('ret', [ fn.type.ret, fn.type.ret.v(0) ]);
  }
}
module.exports = Or;
