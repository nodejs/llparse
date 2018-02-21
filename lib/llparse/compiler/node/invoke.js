'use strict';

const node = require('./');

class Invoke extends node.Node {
  constructor(name, code, map) {
    super('invoke', name);

    this.code = code;
    this.map = map;
  }

  prologue(ctx, fn) {
    return fn.body;
  }

  doBuild(ctx, fn, body) {
  }
}
module.exports = Invoke;
