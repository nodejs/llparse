'use strict';

const assert = require('assert');

class Struct {
  constructor(name) {
    this.name = name;

    this.map = new Map();
    this.props = [];
  }

  define(name, type, info) {
    assert(!this.has(name), `Duplicate entry in ${this.name}`);

    const index = this.props.length;
    const entry = { name, type, info };

    this.props.push(entry);
    this.map.set(name, index);
  }

  has(name) {
    return this.map.has(name);
  }

  lookup(name) {
    return this.map.get(name);
  }

  forEach(callback) {
    return this.map.forEach(callback);
  }

  serialize() {
    let out = '';

    out += `%${this.name} = type {\n`;
    this.props.forEach((prop, index) => {
      const isLast = index === this.props.length - 1;

      out += `  ${prop.type}${isLast ? '' : ','}`;
      out += ` ; ${index} => ${prop.info.comment}\n`;
    });
    out += '}\n';

    return out;
  }

  serializeC(prefix) {
    let out = '';
    const name = this.name;

    out += `typedef struct ${prefix}_${name}_s ${prefix}_${name}_t;\n`;
    out += `void ${prefix}_${name}_init(${prefix}_${name}_t* s);\n`;

    return out;
  }
}
module.exports = Struct;
