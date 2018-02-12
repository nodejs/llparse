'use strict';

const kCurrent = Symbol('current');
const kError = Symbol('error');
const kIndex = Symbol('index');

const dsl = require('./');

class State extends dsl.ir.Struct {
  constructor() {
    super('state');

    this.define(kCurrent, 'i8* (%state*, i8*, i64)*', []);
    this.define(kIndex, 'i64', []);
    this.define(kError, 'i32', []);
  }

  define(key, type, args) {
    const commentKey = key === kError ? '[error]' :
      key === kCurrent ? '[current]' :
      key === kIndex ? '[index]' :
      key;
    let comment = `${commentKey}`;
    if (args.length !== 0)
      out += ` ${JSON.stringify(args)}`;

    super.define(key, type, { comment });
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
    out += `}\n`;

    return out;
  }

  serializeC(prefix) {
    let out = '';
    return out + super.serializeC();
  }
}
module.exports = State;
