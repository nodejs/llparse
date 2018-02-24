'use strict';

const assert = require('assert');

const node = require('./');
const llparse = require('../');

const kCheckIsMatch = llparse.symbols.kCheckIsMatch;
const kOtherwise = llparse.symbols.kOtherwise;
const kSignature = llparse.symbols.kSignature;

const kName = Symbol('name');

class Node {
  constructor(name, signature) {
    this[kName] = name;
    this[kSignature] = signature;

    this[kOtherwise] = null;
  }

  get name() { return this[kName]; }

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
