'use strict';

const assert = require('assert');

const llparse = require('./');

class Invoke extends llparse.Node {
  constructor(callback, next) {
    assert(next instanceof llparse.Node,
      'Invalid `next` argument of `.invoke()`');
    super('invoke_' + callback);

    this.callback = callback;
    this.next = next;
  }
}
module.exports = Invoke;
