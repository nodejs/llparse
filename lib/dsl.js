'use strict';

const Compiler = require('./dsl/compiler');

// API, really

class DSL {
  constructor(prefix, source) {
    this.prefix = prefix;
    this.source = source;
  }

  compile() {
    const compiler = new Compiler(this.prefix, this.source);
    return compiler.compile();
  }
}
module.exports = DSL;
