'use strict';

const ir = require('./');

class Intrinsic extends ir.Base {
  constructor(name, args) {
    super('intrinsic');

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
    return 'match';
  }

  serializeNext(reporter) {
    return 'next';
  }

  serializeRedirect(reporter) {
    return 'redirect';
  }

  serializeError(reporter) {
    return 'error';
  }
}
module.exports = Intrinsic;
