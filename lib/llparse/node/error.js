'use strict';

const node = require('./');

const kCode = Symbol('code');
const kReason = Symbol('reason');

class Error extends node.Node {
  constructor(code, reason) {
    super('error', 'match');

    this[kCode] = code;
    this[kReason] = reason;
  }

  get code() { return this[kCode]; }
  get reason() { return this[kReason]; }

  otherwise() { throw new Error('Not supported'); }
  skipTo() { throw new Error('Not supported'); }
}
module.exports = Error;
