'use strict';

const llparse = require('../');
const node = require('./');

const kSpan = llparse.symbols.kSpan;

class SpanStart extends node.Node {
  constructor(span, code) {
    super('span_start_' + code.name);

    this[kSpan] = span;
  }

  peek() { throw new Error('Not supported'); }
  match() { throw new Error('Not supported'); }
  select() { throw new Error('Not supported'); }
}
module.exports = SpanStart;
