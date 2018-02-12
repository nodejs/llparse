'use strict';

const ir = require('./');

class Intrinsic extends ir.Base {
  constructor(name, args) {
    super('intrinsic');

    // Request tmp for redirect
    if (name === 'redirect')
      this.tmp = null;

    this.name = name;
    this.args = args;

    if (name !== 'match')
      this.out = false;
  }

  build(builder) {
    return builder.build(this.ast);
  }

  serialize(reporter) {
    const name = this.name;

    if (name === 'match')
      return this.serializeMatch(reporter);
    else if (name === 'next')
      return this.serializeNext(reporter);
    else if (name === 'redirect')
      return this.serializeRedirect(reporter);
    else if (name === 'error')
      return this.serializeError(reporter);
    else
      return reporter.error(this.ast, `Unknown intrinsic name=${name}`);
  }

  serializeMatch(reporter) {
    return '; match';
  }

  serializeNext(reporter) {
    return '; next';
  }

  serializeRedirect(reporter) {
    if (this.args.length !== 1)
      return reporter.error('`redirect` must have one argument');

    const target = this.args[0];
    if (target.type !== 'code')
      return reporter.error('`redirect` takes state name as an argument');

    return [
      `%t${this.tmp} = tail call i8* @${target.name}` +
        `(%state* %s, i8* %p, i64 %len)`,
      `ret i8* %t${this.tmp}`
    ];
  }

  serializeError(reporter) {
    return '; error';
  }
}
module.exports = Intrinsic;
