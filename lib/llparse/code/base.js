'use strict';

const llparse = require('../');

const kName = Symbol('name');
const kBody = llparse.symbols.kBody;
const kType = llparse.symbols.kType;

class Code {
  constructor(type, name, body = null) {
    this[kType] = type;
    this[kName] = name;
    this[kBody] = body;
  }

  get name() { return this[kName]; }
}
module.exports = Code;
