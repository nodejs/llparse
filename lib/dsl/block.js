'use strict';

class Block {
  constructor(reporter) {
    this.reporter = reporter;
  }

  error(node, string) {
    return this.reporter.error(node, string);
  }

  compile(stmts) {
  }
}
module.exports = Block;
