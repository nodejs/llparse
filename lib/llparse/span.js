'use strict';

const assert = require('assert');

const llparse = require('./');

const kCode = llparse.symbols.kCode;
const kStartCache = Symbol('startCache');
const kEndCache = Symbol('endCache');

class Span {
  constructor(code) {
    assert(code instanceof llparse.code.Code,
      'Invalid `code` argument of `.span()`, must be a Code instance');

    this[kCode] = code;
    this[kStartCache] = new Map();
    this[kEndCache] = new Map();
  }

  start(otherwise = null) {
    const cache = this[kStartCache];
    if (otherwise && cache.has(otherwise))
      return cache.get(otherwise);

    const res = new llparse.node.SpanStart(this, this[kCode]);
    if (otherwise) {
      res.otherwise(otherwise);
      cache.set(otherwise, res);
    }
    return res;
  }

  end(otherwise = null) {
    const cache = this[kEndCache];
    if (otherwise && cache.has(otherwise))
      return cache.get(otherwise);

    const res = new llparse.node.SpanEnd(this, this[kCode]);
    if (otherwise) {
      res.otherwise(otherwise);
      cache.set(otherwise, res);
    }
    return res;
  }
}
module.exports = Span;
