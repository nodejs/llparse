'use strict';

const assert = require('assert');

const internal = require('./llparse/');

const kCode = Symbol('code');
const kTransform = Symbol('transform');
const kPrefix = Symbol('prefix');
const kProperties = Symbol('properties');

// API, really

class CodeAPI {
  constructor(prefix) {
    this[kPrefix] = prefix;
  }

  // TODO(indutny): should we allow custom bodies here?
  match(name) {
    return new internal.code.Match(name, null);
  }

  // TODO(indutny): should we allow custom bodies here?
  value(name) {
    return new internal.code.Value(name, null);
  }

  span(name) {
    return new internal.code.Span(name, null);
  }

  // Helpers

  store(field) {
    return new internal.code.Store(this[kPrefix] + '__store_' + field, field);
  }

  load(field) {
    return new internal.code.Load(this[kPrefix] + '__load_' + field, field);
  }
}

class TransformAPI {
  toLowerUnsafe() {
    return new internal.transform.Transform('to_lower_unsafe');
  }
}

class LLParse {
  constructor(prefix) {
    this[kPrefix] = prefix || 'llparse';

    this[kCode] = new CodeAPI(this[kPrefix]);
    this[kTransform] = new TransformAPI();

    this[kProperties] = {
      set: new Set(),
      list: []
    };
  }

  static create(prefix) {
    return new LLParse(prefix);
  }

  get prefix() { return this[kPrefix]; }
  get code() { return this[kCode]; }
  get transform() { return this[kTransform]; }

  node(name) {
    return new internal.node.Match(name);
  }

  error(code, reason) {
    return new internal.node.Error(code, reason);
  }

  invoke(name, map, otherwise) {
    return new internal.node.Invoke(name, map, otherwise);
  }

  property(type, name) {
    assert.strictEqual(typeof type, 'string',
      'The first argument of `.property()` must be a type name');
    assert.strictEqual(typeof name, 'string',
      'The second argument of `.property()` must be a property name');

    if (/^_/.test(name))
      throw new Error(`Can't use internal property name: "${name}"`);

    const props = this[kProperties];
    if (props.set.has(name))
      throw new Error(`Duplicate property with a name: "${name}"`);

    if (!internal.constants.USER_TYPES.hasOwnProperty(type))
      throw new Error(`Unknown property type: "${type}"`);
    type = internal.constants.USER_TYPES[type];

    const prop = new internal.Property(type, name);
    props.set.add(name);
    props.list.push(prop);
  }

  span(callback) {
    return new internal.Span(callback);
  }

  build(root, options) {
    assert(root, 'Missing required argument for `.build(root)`');
    assert(root instanceof internal.node.Node,
      'Invalid value of `root` in `.build(root)');

    options = options || {};

    const c = new internal.compiler.Compiler({
      prefix: this.prefix,
      properties: this[kProperties].list,
      debug: options.debug || false
    });
    return c.build(root);
  }
}
module.exports = LLParse;
