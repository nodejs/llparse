'use strict';

class Stage {
  constructor(ctx, name) {
    this.ctx = ctx;
    this.name = name;
  }

  build() {
    throw new Error('Not implemented');
  }
}
module.exports = Stage;
