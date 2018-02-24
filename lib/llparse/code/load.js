'use strict';

const assert = require('assert');

const code = require('./');

const kCompile = Symbol('compile');

class Load extends code.Match {
  constructor(name, field) {
    const store = (context) => this[kCompile](context, field);

    super(name, store);
  }

  [kCompile](context, field) {
    const body = context.fn.body;

    const stateType = context.state.type.to;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    assert(context.ret.isInt());

    const adj = context.truncate(body, fieldType, context.load(body, field),
      context.ret);
    body.terminate('ret', [ context.ret, adj ]);
  }
}
module.exports = Load;
