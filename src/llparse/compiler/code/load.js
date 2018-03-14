'use strict';

const code = require('./');

class Load extends code.Code {
  constructor(name, field) {
    super('load', 'match', name);

    this.field = field;
    this.cacheKey = `load_${this.field}`;
  }

  build(ctx, fn) {
    const body = fn.body;
    const field = this.field;

    const { returnType } = this.getTypes(ctx, fn, field);

    const adj = ctx.truncate(body, ctx.load(fn, body, field), returnType);
    body.ret(adj);
  }
}
module.exports = Load;
