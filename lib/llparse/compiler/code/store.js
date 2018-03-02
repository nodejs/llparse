'use strict';

const assert = require('assert');

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

    // TODO(indutny): de-duplicate
    const stateType = ctx.state;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    assert(match.type.isInt());

    const adj = ctx.truncate(body, match.type, match, fieldType);

    ctx.store(fn, body, field, adj);
    body.terminate('ret', [ fn.type.ret, fn.type.ret.v(0) ]);
  }
}
module.exports = Store;
