'use strict';

const assert = require('assert');

const code = require('./');

const kCompile = Symbol('compile');

class Store extends code.Value {
  constructor(name, field) {
    const store = (ir, context) => this[kCompile](ir, context, field);

    super(name, store);
  }

  [kCompile](ir, context, field) {
    const body = context.fn.body;

    const stateType = context.state.type.to;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    assert(context.match.type.isInt());
    let adj;

    // Same type!
    if (fieldType.type === context.match.type) {
      adj = context.match;
    // Extend
    } else if (fieldType.width > context.match.type.width) {
      adj = ir._('sext',
        [ context.match.type, context.match, 'to', fieldType ]);
      body.push(adj);
    // Truncate
    } else {
      assert(fieldType.width < context.match.type.width);
      adj = ir._('trunc',
        [ context.match.type, context.match, 'to', fieldType ]);
      body.push(adj);
    }

    context.store(body, field, adj);
    body.terminate('ret', [ context.ret, context.ret.v(0) ]);
  }
}
module.exports = Store;
