'use strict';

const assert = require('assert');
const Struct = require('./struct');

class Settings extends Struct {
  constructor() {
    super('settings');
  }

  define(key, type, args) {
    let nativeType;
    if (type === 'notify') {
      nativeType = 'i32 (%state*)*';
    } else {
      assert.equal(type, 'data');
      nativeType = 'i32 (%state*, i8*, i64)*';
    }

    let comment = `${key}: ${type}`;
    if (args.length !== 0)
      comment += ` ${JSON.stringify(args)}`;

    super.define(key, nativeType, comment);
  }
}
module.exports = Settings;
