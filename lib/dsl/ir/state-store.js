'use strict';

const ir = require('./');

class Constant extends ir.Base {
  constructor(lookup, value) {
    super('state:store');

    this.out = false;
    this.tmp = 1;

    this.lookup = lookup;
    this.value = value;
  }

  serialize(reporter) {
    const t0 = `%t${this.tmp[0]}`;
    const index = this.lookup.index;
    const type = this.lookup.type;

    let value;
    if (this.value.type === 'constant')
      value = this.value.value;
    else
      value = this.value.out;

    return [
      `; state-store ${this.lookup.name}`,
      `${t0} = getelementptr %state, %state* %s, i32 0, i32 ${index}`,
      `store ${type} ${value}, ${type}* ${t0}`,
    ];
  }
}
module.exports = Constant;
