'use strict';

const node = require('./');

class Single extends node.Node {
  constructor(name) {
    super('single', name);

    this.children = null;
  }

  doBuild(ctx, body, nodes) {
    body.comment('node.Single');

    const pos = ctx.pos.current;

    // Load the character
    const current = ctx.ir._('load', pos.type.to, [ pos.type, pos ]);
    body.push(current);

    const keys = this.children.map(child => child.key);
    const s = ctx.buildSwitch(body, pos.type.to, current, keys);

    s.cases.forEach((body, i) => {
      const child = this.children[i];
      const target = child.next.build(ctx.compilation, nodes);

      this.tailTo(ctx, body, child.noAdvance ? ctx.pos.current : ctx.pos.next,
        target, child.value);
    });

    this.doOtherwise(ctx, nodes, s.otherwise);
  }
}
module.exports = Single;
