'use strict';

const Buffer = require('buffer').Buffer;

exports.toBuffer = (value) => {
  if (typeof value === 'number')
    return Buffer.from([ value ]);
  else
    return Buffer.from(value);
};
