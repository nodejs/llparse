'use strict';

const ir = require('./');

const dsl = require('../');
const constants = dsl.constants;

class Intrinsic extends ir.Base {
  constructor(name, args) {
    super('intrinsic');

    // Request tmp for redirect
    if (name === 'redirect')
      this.tmp = 1;
    else if (name === 'next')
      this.tmp = 3;
    else if (name === 'error')
      this.tmp = 2;

    this.name = name;
    this.args = args;

    if (name !== 'match')
      this.out = false;

    if (name === 'redirect' || name === 'next' || name === 'error')
      this.terminal = true;
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

    const target = this.getTarget(reporter);

    return [
      '; next',
      `${t0} = getelementptr i8, i8* %p, i32 1`,
      `${t1} = icmp ne i64 ${t0}, %end`,
      `br i1 ${t1}, label %non_empty${this.tmp[0]}, ` +
        `label %empty${this.tmp[0]}`,
      '',
      `non_empty${this.tmp[0]}:`,
      '',
      `  ${t2} = tail call i8* @${target}` +
        `(%state* %s, i8* ${t0}, i8* %end)`,
      `  ret i8* ${t2}`,
      '',
      `empty${this.tmp[0]}:`,
      `  ret i8* ${target}`
    ];
  }

  serializeRedirect(reporter) {
    const t0 = `%t${this.tmp[0]}`;
    return [
      `; redirect`,
      `${t0} = tail call i8* @${this.getTarget(reporter)}` +
        `(%state* %s, i8* %p, i8* %end)`,
      `ret i8* ${t0}`
    ];
  }

  serializeError(reporter) {
    if (this.args.length !== 2)
      return reporter.error('`error` must have two arguments');

    if (this.args[0].type !== 'constant' || this.args[1].type !== 'constant')
      return reporter.error('`error` arguments must be constants');

    const code = this.args[0].value;
    const reason = this.args[1].value;

    if (typeof code !== 'number')
      return reporter.error('`error`\'s first argument must be a number');

    if (typeof reason !== 'string')
      return reporter.error('`error`\'s second argument must be a string');

    const t0 = `%t${this.tmp[0]}`;
    const t1 = `%t${this.tmp[1]}`;

    const errIndex = constants.state.ERROR_INDEX;
    const errType = constants.state.ERROR_TYPE;
    const reasonIndex = constants.state.REASON_INDEX;
    const reasonType = constants.state.REASON_TYPE;

    // TODO(indutny): set reason
    return [
      '; error',
      `${t0} = getelementptr %state, %state* %s, i32 0, i32 ${errIndex}`,
      `store ${errType} code, ${errType}* ${t0}`,
      `${t1} = getelementptr %state, %state* %s, i32 0, i32 ${reasonIndex}`,
      `store ${reasonType} c${JSON.stringify(reason)}, ${reasonType}* ${t1}`,
      'ret i8* null'
    ];
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
