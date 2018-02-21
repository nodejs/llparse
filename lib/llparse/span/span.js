'use strict';

const llparse = require('../');

const kCallback = llparse.symbols.kCallback;

class Span {
  constructor(callback) {
    this[kCallback] = callback;
  }

  start(otherwise = null) {
    const res = new llparse.node.SpanStart(this, this[kCallback]);
    if (otherwise)
      res.otherwise(otherwise);
    return res;
  }

  end(otherwise = null) {
    const res = new llparse.node.SpanEnd(this, this[kCallback]);
    if (otherwise)
      res.otherwise(otherwise);
    return res;
  }
}
module.exports = Span;
