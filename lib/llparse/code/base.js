'use strict';

const llparse = require('../');

const kName = Symbol('name');
const kSignature = llparse.symbols.kSignature;

class Code {
  constructor(signature, name) {
    this[kSignature] = signature;
    this[kName] = name;
  }

  get name() { return this[kName]; }
}
module.exports = Code;
