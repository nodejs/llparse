'use strict';

const node = require('./');

class Single extends node.Node {
  constructor(...args) {
    super('single', ...args);

    this.children = null;
  }

  getChildren() {
    return super.getChildren().concat(this.children.map((child) => {
      return { node: child.next, noAdvance: child.noAdvance, key: child.key };
    }));
  }

  doBuild(ctx, body) {
    const pos = ctx.pos.current;

    // Load the character
    let current = body.load(pos);

    // Transform the character if needed
    if (this.transform) {
      const res  = ctx.compilation.buildTransform(this.transform,
        body, current);
      body = res.body;
      current = res.current;
    }

    const weights = new Array(1 + this.children.length).fill('likely');

    // Mark error branches as unlikely
    this.children.forEach((child, i) => {
      if (child.next instanceof node.Error)
        weights[i + 1] = 'unlikely';
    });

    if (this.otherwise instanceof node.Error)
      weights[0] = 'unlikely';

    const keys = this.children.map(child => child.key);
    const s = ctx.buildSwitch(body, current, keys, weights);

    s.cases.forEach((body, i) => {
      const child = this.children[i];

      this.tailTo(ctx, body, child.noAdvance ? ctx.pos.current : ctx.pos.next,
        child.next, child.value);
    });

    this.doOtherwise(ctx, s.otherwise);
  }
}
module.exports = Single;
