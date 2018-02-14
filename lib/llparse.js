'use strict';

const IR = require('llvm-ir');

const internal = require('./llparse/');

// API, really

class LLParse {
  constructor(prefix) {
    this.prefix = prefix;
    this.ir = new IR();
  }

  static create(prefix) {
    return new LLParse(prefix);
  }

  node(name) {
    return new internal.node.Node(name);
  }

  error(code, reason) {
    return new internal.node.Error(code, reason);
  }

  invoke(name, next) {
    return new internal.node.Invoke(name, next);
  }

  build() {
    return this.ir.build();
  }
}
module.exports = LLParse;
