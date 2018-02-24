'use strict';

const assert = require('assert');

const node = require('./');
const llparse = require('../');

const kCases = llparse.symbols.kCases;
const kCheckIsMatch = llparse.symbols.kCheckIsMatch;
const kSignature = llparse.symbols.kSignature;
const kTransform = llparse.symbols.kTransform;

class Match extends node.Node {
  constructor(name) {
    super(name, 'match');

    this[kTransform] = null;

    this[kCases] = [];
  }

  transform(t) {
    assert.strictEqual(this[kTransform], null, 'Can\'t apply transform twice');
    assert(t instanceof llparse.transform.Transform,
      '`.transform()` argument must be a `Transform` instance');
    this[kTransform] = t;

    return this;
  }

  peek(value, next) {
    // .peek([ ... ], next)
    if (Array.isArray(value)) {
      value.forEach(value => this.peek(value, next));
      return this;
    }

    assert(next instanceof node.Node, 'Invalid `next` argument of `.match()`');
    this[kCheckIsMatch](next, '.peek()');

    this[kCases].push(new llparse.case.Peek(value, next));

    return this;
  }

  match(value, next) {
    // .match([ ... ], next)
    if (Array.isArray(value)) {
      value.forEach(value => this.match(value, next));
      return this;
    }

    assert(next instanceof node.Node, 'Invalid `next` argument of `.match()`');
    this[kCheckIsMatch](next, '.match()');

    this[kCases].push(new llparse.case.Match(value, next));

    return this;
  }

  select(key, value, next) {
    // .select(key, value, next)
    const pairs = [];
    if (Buffer.isBuffer(key) || typeof key === 'number' ||
        typeof key === 'string') {
      assert.strictEqual(typeof value, 'number',
        '`.select(key, value, next)` is a signature of the method');

      pairs.push({ key, value });
    } else {
      assert.strictEqual(typeof key, 'object',
        '`.select()` first argument must be either an object or a key');

      const map = key;
      next = value;
      value = null;

      Object.keys(map).forEach((key) => pairs.push({ key, value: map[key] }));
    }

    assert(next instanceof node.Invoke,
      'Invalid `next` argument of `.select()`, must be an `.invoke()` node');
    assert.strictEqual(next[kSignature], 'value',
      `Invoke of "${next.name}" can't be a target of \`.select()\``);

    const select = new llparse.case.Select(next);
    pairs.forEach(pair => select.add(pair.key, pair.value));

    this[kCases].push(select);

    return this;
  }
}
module.exports = Match;
