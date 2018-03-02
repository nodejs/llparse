'use strict';

const llparse = require('../');

const kName = Symbol('name');
const kType = llparse.symbols.kType;

class Code {
  constructor(signature, name) {
    // TODO(indutny): rename to kSignature everywhere
    this[kType] = signature;
    this[kName] = name;
  }

  get name() { return this[kName]; }
}
module.exports = Code;
