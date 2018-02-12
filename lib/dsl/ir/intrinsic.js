'use strict';

const ir = require('./');

class Intrinsic extends ir.Base {
  constructor(name, args) {
    super('intrinsic');

    // Request tmp for redirect
    if (name === 'redirect')
      this.tmp = 1;
    else if (name === 'next')
      this.tmp = 4;

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
    const t0 = `%t${this.tmp[0]}`;
    const t1 = `%t${this.tmp[1]}`;
    const t2 = `%t${this.tmp[2]}`;
    const t3 = `%t${this.tmp[3]}`;

    return [
      '; next',
      `${t0} = getelementptr i8, i8* %p, i32 1`,
      `${t1} = sub i64 %len, 1`,
      `${t2} = icmp ne i64 ${t1}, 0`,
      `br i1 ${t2}, label %non_empty${this.tmp[0]}, ` +
        `label %empty${this.tmp[0]}`,
      ``,
      `non_empty${this.tmp[0]}:`,
      ``,
      `${t3} = tail call i8* @${this.getTarget(reporter)}` +
        `(%state* %s, i8* ${t0}, i64 ${t1})`,
      `ret i8* ${t3}`,
      ``,
      `empty${this.tmp[0]}:`
    ];
  }

  serializeRedirect(reporter) {
    const t0 = `%t${this.tmp[0]}`;
    return [
      `; redirect`,
      `${t0} = tail call i8* @${this.getTarget(reporter)}` +
        `(%state* %s, i8* %p, i64 %len)`,
      `ret i8* ${t0}`
    ];
  }

  serializeError(reporter) {
    return '; error';
  }

  getTarget(reporter) {
    if (this.args.length !== 1)
      return reporter.error('`redirect` must have one argument');

    const target = this.args[0];
    if (target.type !== 'code')
      return reporter.error('`redirect` takes state name as an argument');

    return target.name;
  }
}
module.exports = Intrinsic;
