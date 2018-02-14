'use strict';

const llparse = require('./');

class Invoke extends llparse.Node {
  constructor(callback, next) {
    super('invoke_' + callback);

    this.callback = callback;
    this.next = next;
  }
}
module.exports = Invoke;
