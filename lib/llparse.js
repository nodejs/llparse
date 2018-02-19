'use strict';

const assert = require('assert');

const internal = require('./llparse/');

const kCode = Symbol('code');

// API, really

class CodeAPI {
  match(name, body) {
    return new internal.code.Match(name, body);
  }

  value(name, body) {
    return new internal.code.Value(name, body);
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
    assert(root, 'Missing required argument for `.build(root)`');
    assert(root instanceof internal.node.Node,
      'Invalid value of `root` in `.build(root)');

    const c = new internal.Compiler(this.prefix);
    return c.build(root);
  }
}
module.exports = LLParse;
