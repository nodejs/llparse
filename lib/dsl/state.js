'use strict';

const assert = require('assert');

const kCurrent = Symbol('current');
const kError = Symbol('error');
const kReason = Symbol('reason');
const kIndex = Symbol('index');

const dsl = require('./');
const constants = dsl.constants;

class State extends dsl.ir.Struct {
  constructor() {
    super('state');

    this.define(kCurrent, 'i8* (%state*, i8*, i8*)*', []);
    this.define(kIndex, 'i64', []);
    assert.strictEqual(
      this.define(kError, constants.state.ERROR_TYPE, []),
      constants.state.ERROR_INDEX);
    assert.strictEqual(
      this.define(kReason, constants.state.REASON_TYPE, []),
      constants.state.REASON_INDEX);
  }

  define(key, type, args) {
    const commentKey = key === kError ? '[error]' :
      key === kCurrent ? '[current]' :
      key === kIndex ? '[index]' :
      key === kReason ? '[reason]' :
      key;
    let comment = `${commentKey}`;
    if (args.length !== 0)
      out += ` ${JSON.stringify(args)}`;

    return super.define(key, type, { comment });
  }

  current() {
    return this.lookup(kCurrent);
  }

  error() {
    return this.lookup(kError);
  }

  index() {
    return this.lookup(kIndex);
  }

  serialize(prefix, current) {
    let out = '';

    out += super.serialize();
    out += '\n';

    // TODO(indutny): set current style
    out += `define void @${prefix}_init(%state* %s) {\n`;
    let i = 0;
    this.forEach((prop, key) => {
      const index = prop.index;

      const t0 = `%t${i++}`;
      out +=
        `  ${t0} = getelementptr %state, %state* %s, i32 0, i32 ${index}\n`;

      let value;
      if (key === kCurrent)
        value = `@${current}`;
      else if (key === kReason)
        value = 'null';
      else
        value = '0';

      out += `  store ${prop.type} ${value}, ${prop.type}* ${t0}\n`;
    });
    out += '  ret void\n';
    out += '}\n';

    return out;
  }

  serializeC(prefix) {
    let out = '';
    return out + super.serializeC();
  }
}
module.exports = State;
