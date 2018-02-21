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
    const info = this.computeActive(nodes);
    const graph = this.computeOverlap(info);
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
    const spans = new Set();
    while (queue.size !== 0) {
      const node = queue.values().next().value;
      queue.delete(node);

      const active = activeMap.get(node);

      if (node instanceof llparse.node.SpanStart) {
        const span = node[kSpan][kCallback];
        spans.add(span);
        active.add(span);
      }

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

    const ends = nodes.filter(node => node instanceof llparse.node.SpanEnd);
    ends.forEach((end) => {
      const active = activeMap.get(end);
      assert(active.has(end[kSpan][kCallback]),
        `Unmatched span end for "${end[kSpan][kCallback]}"`);
    });

    return { active: activeMap, spans: Array.from(spans) };
  }

  computeOverlap(info) {
    const active = info.active;
    const overlap = new Map();

    info.spans.forEach(span => overlap.set(span, new Set()));
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
