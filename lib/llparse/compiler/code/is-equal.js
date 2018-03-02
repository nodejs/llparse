'use strict';

const assert = require('assert');

const code = require('./');
const llparse = require('../../');

const BOOL = llparse.constants.BOOL;

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

    // TODO(indutny): de-duplicate here and everywhere
    const stateType = ctx.state;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    assert(fn.type.ret.isInt());

    const fieldValue = ctx.load(fn, body, field);

    const cmp = ctx.ir._('icmp', [ 'eq', fieldType, fieldValue ],
      fieldType.v(value));
    body.push(cmp);
    const res = ctx.truncate(body, BOOL, cmp, fn.type.ret);

    body.terminate('ret', [ fn.type.ret, res ]);
  }
}
module.exports = IsEqual;
