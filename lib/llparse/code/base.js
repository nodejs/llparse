'use strict';

const llparse = require('../');

const kName = Symbol('name');
const kType = Symbol('type');
const kBody = llparse.symbols.kBody;

class Code {
  constructor(type, name, body = null) {
    this[kType] = type;
    this[kName] = name;
    this[kBody] = body;

    // TODO(indutny): custom code generators
    if (body)
      throw new Error('Not implemented yet');
  }

  get type() { return this[kType]; }
  get name() { return this[kName]; }
}
module.exports = Code;
