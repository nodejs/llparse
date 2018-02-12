'use strict';

const Base = require('./').Base;

class Error extends Base {
  static validateArgs(args) {
    if (args.length !== 2)
      return false;

    return args[0].type === 'Identifier' &&
      args[1].type === 'Literal' &&
      typeof args[1].value === 'string';
  }

  constructor(args, body) {
    super('error');

    this.code = body.lookup(args[0]);
    this.description = args[1].value;
  }
}
module.exports = Error;
