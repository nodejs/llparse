'use strict';

const IR = require('llvm-ir');

const node = require('./');

class Single extends node.Node {
  constructor(name) {
    super('single', name);

    this.children = null;
  }

  setOtherwise(otherwise, skip) {
    // Break loops
    if (this.otherwise === otherwise)
      return;

    super.setOtherwise(otherwise, skip);
    this.children.forEach(child => child.next.setOtherwise(otherwise, skip));
  }

  doBuild(ctx, fn, body, nodes) {
    const pos = ctx.posArg(fn);

    // Load the character
    const current = IR._('load', pos.type.to, [ pos.type, pos ]);
    body.push(current);

    const keys = this.children.map(child => child.key);
    const s = ctx.buildSwitch(body, pos.type.to, current, keys);

    s.cases.forEach((body, i) => {
      const child = this.children[i].next.build(ctx, nodes);
    });

  }
}
module.exports = Single;
