'use strict';

const Base = require('./').Base;

class Next extends Base {
  constructor() {
    super('next');
    this.target = args[0].name;
  }

  static validateArgs(args) {
    if (args.length !== 1 || !args[0])
      return false;

    return args[0].type === 'Identifier';
  }
}
module.exports = Next;
