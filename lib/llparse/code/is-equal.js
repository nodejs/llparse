'use strict';

const assert = require('assert');
const llparse = require('../');

const BOOL = llparse.constants.BOOL;

const code = require('./');

const kCompile = Symbol('compile');

class IsEqual extends code.Match {
  constructor(name, field, value) {
    assert.strictEqual(typeof value, 'number',
      '`.update()`\'s `value` argument must be a number');
    assert.strictEqual(value, value | 0,
      '`.update()`\'s `value` argument must be an integer');

    const body = (context) => this[kCompile](context, field, value);

    super(name, body);
  }

  [kCompile](context, field, value) {
    const body = context.fn.body;

    const stateType = context.state.type.to;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    assert(context.ret.isInt());

    const fieldValue = context.load(body, field);

    const cmp = context.ir._('icmp', [ 'eq', fieldType, fieldValue ],
      fieldType.v(value));
    body.push(cmp);
    const res = context.truncate(body, BOOL, cmp, context.ret);

    body.terminate('ret', [ context.ret, res ]);
  }
}
module.exports = IsEqual;
