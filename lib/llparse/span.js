'use strict';

const assert = require('assert');

const llparse = require('./');

const kCode = llparse.symbols.kCode;

class Span {
  constructor(code) {
    assert(code instanceof llparse.code.Code,
      'Invalid `code` argument of `.span()`, must be a Code instance');

    this[kCode] = code;
  }

  start(otherwise = null) {
    const res = new llparse.node.SpanStart(this, this[kCode]);
    if (otherwise)
      res.otherwise(otherwise);
    return res;
  }

  end(otherwise = null) {
    const res = new llparse.node.SpanEnd(this, this[kCode]);
    if (otherwise)
      res.otherwise(otherwise);
    return res;
  }
}
module.exports = Span;
