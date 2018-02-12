'use strict';

const ir = require('./');

class Code extends ir.Base {
  constructor(name, ast) {
    super('code');

    this.out = false;

    this.name = name;
    this.ast = ast;
    this.blocks = null;
  }

  build(builder) {
    this.blocks = builder.build(this.ast);
  }

  serialize(reporter) {
    if (!this.blocks)
      return reporter.error(this.ast, 'Not built!');
    if (this.blocks.length === 0)
      return reporter.error(this.ast, 'No blocks to serialize');

    let out = `define i32 @${this.name}(%state* %s) {\n`;

    // TODO(indutny): switch!

    this.blocks.forEach((block) => {
      out += block.serialize(reporter);
    });

    out += '}\n';
    return out;
  }
}
module.exports = Code;
