'use strict';

const assert = require('assert');

const llparse = require('../');

const kOtherwise = llparse.symbols.kOtherwise;
const kNoAdvance = llparse.symbols.kNoAdvance;
const kCases = llparse.symbols.kCases;
const kReceives = Symbol('receives');

class Node {
  constructor(name) {
    this.name = name;

    this[kCases] = [];
    this[kReceives] = null;

    this[kOtherwise] = null;
    this[kNoAdvance] = false;
  }

  match(value, next) {
    // .match([ ... ], next)
    if (Array.isArray(value)) {
      value.forEach(value => this.match(value, next));
      return this;
    }

    assert(next instanceof Node, 'Invalid `next` argument of `.match()`');
    if (next[kReceives] === null)
      next[kReceives] = 'match';
    assert.strictEqual(next[kReceives], 'match',
      `"${next.name}" can't be a target of ` +
        'both `.select()` and `.match()`');

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

    assert(next instanceof Node, 'Invalid `next` argument of `.select()`');
    if (next[kReceives] === null)
      next[kReceives] = 'select';
    assert.strictEqual(next[kReceives], 'select',
      `"${next.name}" can't be a target of ` +
        'both `.select()` and `.match()`');

    const select = new llparse.case.Select(next);
    pairs.forEach(pair => select.add(pair.key, pair.value));

    this[kCases].push(select);

    return this;
  }

  otherwise(next) {
    assert(next instanceof Node, 'Invalid `next` argument of `.otherwise()`');
    assert.strictEqual(this[kOtherwise], null,
      'Duplicate `.otherwise()`/`.skipTo()`');
    this[kOtherwise] = new llparse.case.Otherwise(next);

    return this;
  }

  skipTo(next) {
    assert(next instanceof Node, 'Invalid `next` argument of `.otherwise()`');
    assert.strictEqual(this[kOtherwise], null,
      'Duplicate `.skipTo()`/`.otherwise()`');
    this[kOtherwise] = new llparse.case.Otherwise(next, true);

    return this;
  }
}
module.exports = Node;
