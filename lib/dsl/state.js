'use strict';

const kState = Symbol('state');
const kError = Symbol('error');

const dsl = require('./');

class State extends dsl.ir.Struct {
  constructor() {
    super('state');

    this.define(kState, 'i8 (%state*, i8*)', []);
    this.define(kError, 'i32', []);
  }

  define(key, type, args) {
    const commentKey = key === kError ? '[error]' :
      key === kState ? '[state]' : key;
    let comment = `${commentKey}`;
    if (args.length !== 0)
      out += ` ${JSON.stringify(args)}`;

    super.define(key, type, comment);
  }
}
module.exports = State;
