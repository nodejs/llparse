'use strict';

const assert = require('assert');

const code = require('./');

const kCompile = Symbol('compile');

class Store extends code.Value {
  constructor(name, field) {
    const store = context => this[kCompile](context, field);

    super(name, store);
  }

  [kCompile](context, field) {
    const body = context.fn.body;

    const stateType = context.state.type.to;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    assert(context.match.type.isInt());

    const adj = context.truncate(body, context.match.type, context.match,
      fieldType);

    context.store(body, field, adj);
    body.terminate('ret', [ context.ret, context.ret.v(0) ]);
  }
}
module.exports = Store;
