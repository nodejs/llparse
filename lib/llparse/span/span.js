'use strict';

const llparse = require('../');

const kCallback = llparse.symbols.kCallback;

class Span {
  constructor(callback) {
    this[kCallback] = callback;
  }

  start() {
    return new llparse.node.SpanStart(this, this[kCallback]);
  }

  end() {
    return new llparse.node.SpanEnd(this, this[kCallback]);
  }
}
module.exports = Span;
