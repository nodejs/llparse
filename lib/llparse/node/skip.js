'use strict';

const llparse = require('./');

class Skip extends llparse.Node {
  constructor() {
    super('skip');
  }
}
module.exports = Skip;
