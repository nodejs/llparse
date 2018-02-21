'use strict';

const assert = require('assert');

const llparse = require('../');
const span = require('./');

const kCallback = llparse.symbols.kCallback;
const kCases = llparse.symbols.kCases;
const kOtherwise = llparse.symbols.kOtherwise;
const kNoAdvance = llparse.symbols.kNoAdvance;
const kSpan = llparse.symbols.kSpan;

class Allocator {
  execute(root) {
    const nodes = this.getNodes(root);
    const activeMap = this.computeActive(nodes);

    console.log(activeMap);
  }

  getNodes(root, set) {
    const res = new Set();
    const queue = [ root ];
    while (queue.length !== 0) {
      const node = queue.pop();
      if (res.has(node))
        continue;
      res.add(node);

      this.getChildren(node).forEach(child => queue.push(child));
    }
    return Array.from(res);
  }

  computeActive(nodes) {
    const activeMap = new Map();
    nodes.forEach(node => activeMap.set(node, new Set()));

    const queue = new Set(nodes);
    while (queue.size !== 0) {
      const node = queue.values().next().value;
      queue.delete(node);

      const active = activeMap.get(node);

      if (node instanceof llparse.node.SpanStart)
        active.add(node[kSpan][kCallback]);

      active.forEach((span) => {
        // Don't propagate span past the spanEnd
        if (node instanceof llparse.node.SpanEnd &&
            span === node[kSpan][kCallback]) {
          return;
        }

        this.getChildren(node).forEach((child) => {
          // Disallow loops
          if (child instanceof llparse.node.SpanStart) {
            assert.notStrictEqual(child[kSpan][kCallback], span,
              `Detected loop in span "${span}"`);
          }

          const set = activeMap.get(child);
          if (set.has(span))
            return;

          set.add(span);
          queue.add(child);
        });
      });
    }

    return activeMap;
  }

  getChildren(node) {
    const res = [];

    // `error` nodes have no `otherwise`
    if (node[kOtherwise] !== null)
      res.push(node[kOtherwise].next);
    node[kCases].forEach(c => res.push(c.next));

    return res;
  }
}
module.exports = Allocator;
