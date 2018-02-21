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
    const queue = new Set();
    this.getNodes(root, queue);

    const activeMap = new Map();
    queue.forEach(node => activeMap.set(node, new Set()));

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

    console.log(activeMap);
  }

  getNodes(root, set) {
    const queue = [ root ];
    while (queue.length !== 0) {
      const node = queue.pop();
      if (set.has(node))
        continue;
      set.add(node);

      this.getChildren(node).forEach(child => queue.push(child));
    }
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
