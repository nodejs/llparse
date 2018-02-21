'use strict';

const node = require('./');
const llparse = require('../');

const kCode = Symbol('code');
const kReason = Symbol('reason');

class Error extends node.Node {
  constructor(code, reason) {
    super('error');

    this[kCode] = code;
    this[kReason] = reason;
  }

  get code() { return this[kCode]; }
  get reason() { return this[kReason]; }

  match() { throw new Error('Not supported'); }
  select() { throw new Error('Not supported'); }
  otherwise() { throw new Error('Not supported'); }
  skipTo() { throw new Error('Not supported'); }
}
module.exports = Error;
