'use strict';

const llparse = require('../');
const node = require('./');

const kSpan = llparse.symbols.kSpan;

class SpanStart extends node.Node {
  constructor(span, code) {
    super('span_start_' + code.name, 'match');

    this[kSpan] = span;
  }
}
module.exports = SpanStart;
