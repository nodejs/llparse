'use strict';

const assert = require('assert');
const Buffer = require('buffer').Buffer;

exports.toBuffer = (value) => {
  if (typeof value === 'number') {
    assert.strictEqual(value, value >>> 0,
      'Invalid char value, must be integer');
    assert(0 <= value <= 255, 'Invalid char value, must be between 0 and 255');

    return Buffer.from([ value ]);
  } else {
    assert.strictEqual(typeof value, 'string',
      'Invalid value for a Buffer');
    return Buffer.from(value);
  }
};
