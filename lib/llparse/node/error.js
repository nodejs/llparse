'use strict';

const node = require('./');
const llparse = require('../');

const kNoAdvance = llparse.symbols.kNoAdvance;
const kCode = Symbol('code');
const kReason = Symbol('reason');

class Error extends node.Node {
  constructor(code, reason) {
    super('error');

    this[kCode] = code;
    this[kReason] = reason;

    this[kNoAdvance] = true;
  }

  get code() { return this[kCode]; }
  get reason() { return this[kReason]; }
}
module.exports = Error;
