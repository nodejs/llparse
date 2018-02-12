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

    let out = `define internal i8* @${this.name}` +
      `(%state* %s, i8* %p, i8* %end) {\n`;
    out += `  %self = bitcast i8* (%state*, i8*, i8*)* @${this.name} to i8*\n`;

    // TODO(indutny): switch!
    out += '  br label %clause_0\n';

    this.blocks.forEach((block, index) => {
      out += `clause_${index}:\n`;
      out += block.serialize(reporter);

      if (!block.isFinished())
        out += `  ret i8* %self\n`;
    });

    out += '}\n';
    return out;
  }
}
module.exports = Code;
