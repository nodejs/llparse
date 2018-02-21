'use strict';

const compiler = require('../');

class Builder extends compiler.Stage {
  constructor(ctx) {
    super(ctx, 'span-builder');
  }
}
module.exports = Builder;
