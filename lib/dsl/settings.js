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

  serializeC(prefix) {
    let out = '';
    return out + super.serializeC();
  }
}
module.exports = Settings;
