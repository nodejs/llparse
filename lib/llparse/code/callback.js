'use strict';

const code = require('./');

class Callback extends code.Code {
  constructor(name, body) {
    super('match', name, body);
  }
}
module.exports = Callback;
