'use strict';

const llparse = require('../');
const node = require('./');

const kNoAdvance = llparse.symbols.kNoAdvance;
const kSpan = llparse.symbols.kSpan;

class SpanEnd extends node.Node {
  constructor(span, callback) {
    super('span_end_' + callback);
    this[kNoAdvance] = true;
    this[kSpan] = span;
  }

  match() { throw new Error('Not supported'); }
  select() { throw new Error('Not supported'); }
}
module.exports = SpanEnd;
