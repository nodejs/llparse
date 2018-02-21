'use strict';

const llparse = require('../');
const node = require('./');

const kSpan = llparse.symbols.kSpan;

class SpanStart extends node.Node {
  constructor(span, callback) {
    super('span_start_' + callback);

    this[kSpan] = span;
  }

  match() { throw new Error('Not supported'); }
  select() { throw new Error('Not supported'); }
}
module.exports = SpanStart;
