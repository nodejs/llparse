'use strict';

const llparse = require('../');
const node = require('./');

const kSpan = llparse.symbols.kSpan;

class SpanEnd extends node.Node {
  constructor(span, code) {
    super('span_end_' + code.name, 'match');
    this[kSpan] = span;
  }
}
module.exports = SpanEnd;
