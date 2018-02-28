'use strict';

const Stage = require('./').Stage;

class NodeLoopChecker extends Stage {
  constructor(ctx) {
    super(ctx, 'node-loop-checker');

    this.reachableMap = new Map();
  }

  reachable(from) {
    if (this.reachableMap.has(from))
      return this.reachableMap.get(from);

    const res = new Set([ from ]);
    this.reachableMap.set(from, res);
    return res;
  }

  addEdge(from, to) {
    const target = this.reachable(to);

    let changed = false;
    this.reachable(from).forEach((node) => {
      if (to === node) {
        throw new Error(`Loop detected in "${to.sourceName}", ` +
          `through the backedge from "${from.sourceName}"`);
      }

      if (target.has(node))
        return;

      changed = true;
      target.add(node);
    });

    return changed;
  }

  build() {
    const queue = [ {
      node: this.ctx.stageResults['node-translator'].root,
      key: null
    } ];

    while (queue.length !== 0) {
      const item = queue.pop();
      const lastKey = item.key;
      const node = item.node;

      let children = node.getChildren();

      // Loops like:
      //
      // `nodeA: peek(A)` => `nodeB: match(A), otherwise -> nodeA`
      //
      // should pass the check
      if (lastKey !== null && typeof lastKey === 'number') {
        // Remove all unreachable clauses
        children = children.filter((child) => {
          return child.key === null || child.key === lastKey;
        });

        // See if there is a matching peek clause
        const sameKey = children.some((child) => {
          return child.key === lastKey && !child.noAdvance;
        });
        if (sameKey)
          return;
      }

      children = children.filter(child => child.noAdvance);

      children.forEach((child) => {
        if (this.addEdge(node, child.node))
          queue.push({ node: child.node, key: child.key || lastKey });
      });
    }

    return true;
  }
}
module.exports = NodeLoopChecker;
