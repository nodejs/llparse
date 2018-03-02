'use strict';

const assert = require('assert');

const code = require('./');
const llparse = require('../../');
const constants = llparse.constants;

const BOOL = constants.BOOL;

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

    // TODO(indutny): de-duplicate
    const stateType = ctx.state;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    const current = ctx.load(fn, body, field);

    const masked = ctx.ir._('and', [ fieldType, current ],
      fieldType.v(value));
    body.push(masked);

    const bool = ctx.ir._('icmp', [ 'ne', fieldType, masked ],
      fieldType.v(0));
    body.push(bool);

    const adj = ctx.truncate(body, BOOL, bool, fn.type.ret);
    body.terminate('ret', [ fn.type.ret, adj ]);
  }
}
module.exports = Test;
