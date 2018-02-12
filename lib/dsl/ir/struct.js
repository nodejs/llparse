'use strict';

const assert = require('assert');

class Struct {
  constructor(name) {
    this.name = name;

    this.map = new Map();
    this.props = [];
  }

  define(name, type, comment) {
    assert(!this.has(name), `Duplicate entry in ${this.name}`);

    const index = this.props.length;
    const entry = { name, type, comment };

    this.props.push(entry);
    this.map.set(name, index);
  }

  has(name) {
    return this.map.has(name);
  }

  lookup(name) {
    return this.map.get(name);
  }

  serialize() {
    let out = '';

    out += `%${this.name} = type {\n`;
    this.props.forEach((prop, index) => {
      const isLast = index === this.props.length - 1;

      out += `  ${prop.type}${isLast ? '' : ','}`;
      out += ` ; ${index} => ${prop.comment}\n`;
    });
    out += '}\n';

    return out;
  }
}
module.exports = Struct;
