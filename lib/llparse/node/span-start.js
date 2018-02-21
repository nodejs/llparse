'use strict';

const llparse = require('../');
const node = require('./');

const kNoAdvance = llparse.symbols.kNoAdvance;

class SpanStart extends node.Node {
  constructor() {
    super();
    this[kNoAdvance] = true;
    throw new Error('To be implemented');
  }
}
module.exports = SpanStart;
