'use strict';

const assert = require('assert');

const code = require('./');

const kCompile = Symbol('compile');

class Update extends code.Match {
  constructor(name, field, value) {
    assert.strictEqual(typeof value, 'number',
      '`.update()`\'s `value` argument must be a number');
    assert.strictEqual(value, value | 0,
      '`.update()`\'s `value` argument must be an integer');

    const update = context => this[kCompile](context, field, value);

    super(name, update);
  }

  [kCompile](context, field, value) {
    const body = context.fn.body;

    const stateType = context.state.type.to;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);

    context.store(body, field, fieldType.v(value));
    body.terminate('ret', [ context.ret, context.ret.v(0) ]);
  }
}
module.exports = Update;
