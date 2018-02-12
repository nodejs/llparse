'use strict';

const assert = require('assert');

const dsl = require('./');

class Settings extends dsl.ir.Struct {
  constructor() {
    super('settings');
  }

  define(key, type, args) {
    let nativeType;
    let cType;
    if (type === 'notify') {
      nativeType = 'i32 (%state*)*';
    } else {
      assert.equal(type, 'data');
      nativeType = 'i32 (%state*, i8*, i64)*';
    }

    let comment = `${key}: ${type}`;
    if (args.length !== 0)
      comment += ` ${JSON.stringify(args)}`;

    super.define(key, nativeType, { type, comment });
  }

  serialize(prefix) {
    let out = '';

    out += super.serialize();
    out += '\n';

    // TODO(indutny): set current style
    out += `define void @${prefix}_settings_init(%settings* %s) {\n`;
    let i = 0;
    this.forEach((prop, key) => {
      const index = prop.index;

      const t0 = `%t${i++}`;
      out += `  ${t0} = getelementptr %settings, %settings* %s, i32 0, ` +
        `i32 ${index}\n`;

      out += `  store ${prop.type} null, ${prop.type}* ${t0}\n`;
    });
    out += '  ret void\n';
    out += '}\n';

    return out;
  }

  serializeC(prefix) {
    let out = '';
    return out + super.serializeC();
  }
}
module.exports = Settings;
