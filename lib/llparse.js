'use strict';

const assert = require('assert');

const internal = require('./llparse/');

const kCode = Symbol('code');
const kProperties = Symbol('properties');

// API, really

class CodeAPI {
  match(name, body) {
    return new internal.code.Match(name, body);
  }

  value(name, body) {
    return new internal.code.Value(name, body);
  }

  // Helpers

  store(name, field) {
    return new internal.code.Store(name, field);
  }

  load(name, field) {
    return new internal.code.Load(name, field);
  }
}

class LLParse {
  constructor(prefix) {
    this.prefix = prefix || 'llparse';

    this[kCode] = new CodeAPI();
    this[kProperties] = {
      set: new Set(),
      list: []
    };
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

  property(type, name) {
    if (internal.constants.RESERVED_PROPERTY_NAMES.has(name))
      throw new Error(`Can't use reserved property name: "${name}"`);

    const props = this[kProperties];
    if (props.set.has(name))
      throw new Error(`Duplicate property with a name: "${name}"`);

    const prop = new internal.Property(type, name);
    props.set.add(name);
    props.list.push(prop);
  }

  build(root) {
    assert(root, 'Missing required argument for `.build(root)`');
    assert(root instanceof internal.node.Node,
      'Invalid value of `root` in `.build(root)');

    const c = new internal.Compiler(this.prefix, this[kProperties].list);
    return c.build(root);
  }
}
module.exports = LLParse;
