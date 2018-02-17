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
  }

  select(map, next) {
    assert(next instanceof Node, 'Invalid `next` argument of `.select()`');
    this.cases.push(new llparse.case.Select(map, next));
  }

  otherwise(next) {
    assert(next instanceof Node, 'Invalid `next` argument of `.otherwise()`');
    this.cases.push(new llparse.case.Otherwise(next));
  }
}
module.exports = Node;
