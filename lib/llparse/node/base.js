'use strict';

const assert = require('assert');

const node = require('./');
const llparse = require('../');

const kOtherwise = llparse.symbols.kOtherwise;
const kCases = llparse.symbols.kCases;
const kSignature = llparse.symbols.kSignature;

const kName = Symbol('name');
const kCheckIsMatch = Symbol('checkIsMatch');

class Node {
  constructor(name, signature = 'match') {
    this[kName] = name;
    this[kSignature] = signature;

    this[kCases] = [];

    this[kOtherwise] = null;
  }

  get name() { return this[kName]; }

  peek(value, next) {
    // .peek([ ... ], next)
    if (Array.isArray(value)) {
      value.forEach(value => this.peek(value, next));
      return this;
    }

    assert(next instanceof Node, 'Invalid `next` argument of `.match()`');
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

    assert(next instanceof Node, 'Invalid `next` argument of `.match()`');
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

  otherwise(next) {
    assert(next instanceof Node, 'Invalid `next` argument of `.otherwise()`');
    this[kCheckIsMatch](next, '.otherwise()');

    assert.strictEqual(this[kOtherwise], null,
      'Duplicate `.otherwise()`/`.skipTo()`');
    this[kOtherwise] = new llparse.case.Otherwise(next);

    return this;
  }

  skipTo(next) {
    assert(next instanceof Node, 'Invalid `next` argument of `.skipTo()`');
    this[kCheckIsMatch](next, '.skipTo()');

    assert.strictEqual(this[kOtherwise], null,
      'Duplicate `.skipTo()`/`.otherwise()`');
    this[kOtherwise] = new llparse.case.Otherwise(next, true);

    return this;
  }

  [kCheckIsMatch](next, method) {
    if (!(next instanceof node.Invoke))
      return;

    assert.strictEqual(next[kSignature], 'match',
      `Invoke of "${next.name}" can't be a target of \`${method}\``);
  }
}
module.exports = Node;
