'use strict';

const assert = require('assert');

const code = require('./');

class Load extends code.Code {
  constructor(name, field) {
    super('load', 'match', name);

    this.field = field;
    this.cacheKey = `load_${this.field}`;
  }

  build(ctx, fn) {
    const body = fn.body;
    const field = this.field;

    // TODO(indutny): de-duplicate here and everywhere
    const stateType = ctx.state;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    assert(fn.type.ret.isInt());

    const adj = ctx.truncate(body, fieldType, ctx.load(fn, body, field),
      fn.type.ret);
    body.terminate('ret', [ fn.type.ret, adj ]);
  }
}
module.exports = Load;
