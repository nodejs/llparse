'use strict';

const code = require('./');

class Callback extends code.Code {
  constructor(name, body) {
    super('callback', name, body);
  }
}
module.exports = Callback;
