'use strict';

const node = require('./');

class Sequence extends node.Node {
  constructor(name, select) {
    super('sequence', name);

    this.select = select;
    this.next = null;
  }

  setOtherwise(otherwise, skip) {
    // Break loops
    if (this.otherwise === otherwise)
      return;

    super.setOtherwise(otherwise, skip);
    this.next.setOtherwise(otherwise, skip);
  }

  doBuild(ctx, fn, body, nodes) {
  }
}
module.exports = Sequence;
