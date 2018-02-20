'use strict';

const assert = require('assert');

const code = require('./');

const kCompile = Symbol('compile');

class Load extends code.Match {
  constructor(name, field) {
    const store = (ir, context) => this[kCompile](ir, context, field);

    super(name, store);
  }

  [kCompile](ir, context, field) {
    const body = context.fn.body;

    const stateType = context.state.type.to;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    assert(context.ret.isInt());

    let adj = context.load(body, field);

    // Same type!
    if (fieldType.type === context.ret) {
    // Truncate
    } else if (fieldType.width > context.ret.width) {
      adj = ir._('trunc',
        [ fieldType, adj, 'to', context.ret ]);
      body.push(adj);
    // Extend
    } else {
      assert(fieldType.width < context.ret.width);
      adj = ir._('sext',
        [ fieldType, adj, 'to', context.ret ]);
      body.push(adj);
    }

    body.terminate('ret', [ context.ret, adj ]);
  }
}
module.exports = Load;
