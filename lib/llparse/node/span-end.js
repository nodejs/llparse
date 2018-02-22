'use strict';

const llparse = require('../');
const node = require('./');

const kSpan = llparse.symbols.kSpan;

class SpanEnd extends node.Node {
  constructor(span, code) {
    super('span_end_' + code.name);
    this[kSpan] = span;
  }

  peek() { throw new Error('Not supported'); }
  match() { throw new Error('Not supported'); }
  select() { throw new Error('Not supported'); }
}
module.exports = SpanEnd;
