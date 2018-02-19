'use strict';

const internal = require('./llparse/');

const kCode = Symbol('code');

// API, really

class CodeAPI {
  callback(name, body) {
    return new internal.code.Callback(name, body);
  }

  store(name, body) {
    return new internal.code.Store(name, body);
  }
}

class LLParse {
  constructor(prefix) {
    this.prefix = prefix || 'llparse';

    this[kCode] = new CodeAPI();
  }

  static create(prefix) {
    return new LLParse(prefix);
  }

  get code() { return this[kCode]; }

  node(name) {
    return new internal.node.Node(name);
  }

  error(code, reason) {
    return new internal.node.Error(code, reason);
  }

  invoke(name, map, otherwise) {
    return new internal.node.Invoke(name, map, otherwise);
  }

  skip() {
    return new internal.node.Skip();
  }

  build(root) {
    const c = new internal.Compiler(this.prefix);
    return c.build(root);
  }
}
module.exports = LLParse;
