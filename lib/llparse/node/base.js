'use strict';

const assert = require('assert');

const llparse = require('../');

class Node {
  constructor(name) {
    this.name = name;
    this.cases = [];
    this.noAdvance = false;
  }

  match(value, next) {
    assert(next instanceof Node, 'Invalid `next` argument of `.match()`');
    this.cases.push(new llparse.case.Match(value, next));

    return this;
  }

  select(map, next) {
    assert(next instanceof Node, 'Invalid `next` argument of `.select()`');
    this.cases.push(new llparse.case.Select(map, next));

    return this;
  }

  otherwise(next) {
    assert(next instanceof Node, 'Invalid `next` argument of `.otherwise()`');
    this.cases.push(new llparse.case.Otherwise(next));

    return this;
  }

  skip(next) {
    assert(next instanceof Node, 'Invalid `next` argument of `.otherwise()`');
    this.cases.push(new llparse.case.Otherwise(next, true));

    return this;
  }
}
module.exports = Node;
