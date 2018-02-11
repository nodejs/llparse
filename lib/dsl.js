'use strict';

const esprima = require('esprima');

class DSL {
  constructor(source) {
    this.source = source;
    this.ast = null;
  }

  compile() {
    this.ast = esprima.parse(this.source);
    console.log(this.ast);
  }
}
module.exports = DSL;
