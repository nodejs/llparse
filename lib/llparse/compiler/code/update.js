'use strict';

const assert = require('assert');

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

    // TODO(indutny): de-duplicate
    const stateType = ctx.state;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);

    ctx.store(fn, body, field, fieldType.v(value));
    body.terminate('ret', [ fn.type.ret, fn.type.ret.v(0) ]);
  }
}
module.exports = Update;
