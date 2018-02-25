'use strict';

const assert = require('assert');

const Stage = require('./').Stage;
const compiler = require('../');

class Allocator extends Stage {
  constructor(ctx) {
    super(ctx, 'span-allocator');
  }

  id(node) {
    return node.code;
  }

  build() {
    const nodes = this.getNodes(this.ctx.stageResults['node-translator']);
    const info = this.computeActive(nodes);
    const overlap = this.computeOverlap(info);
    const color = this.color(info.spans, overlap);

    return color;
  }

  getNodes(root) {
    const res = new Set();
    const queue = [ root ];
    while (queue.length !== 0) {
      const node = queue.pop();
      if (res.has(node))
        continue;
      res.add(node);

      node.getChildren().forEach(child => queue.push(child.node));
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

      if (node instanceof compiler.node.SpanStart) {
        const span = this.id(node);
        spans.add(span);
        active.add(span);
      }

      active.forEach((span) => {
        // Don't propagate span past the spanEnd
        if (node instanceof compiler.node.SpanEnd && span === this.id(node))
          return;

        node.getChildren().forEach((child) => {
          const node = child.node;

          // Disallow loops
          if (node instanceof compiler.node.SpanStart) {
            assert.notStrictEqual(this.id(node), span,
              `Detected loop in span "${span.name}"`);
          }

          const set = activeMap.get(node);
          if (set.has(span))
            return;

          set.add(span);
          queue.add(node);
        });
      });
    }

    const ends = nodes
      .filter(node => node instanceof compiler.node.SpanEnd);
    ends.forEach((end) => {
      const active = activeMap.get(end);
      assert(active.has(this.id(end)),
        `Unmatched span end for "${this.id(end).name}"`);
    });

    return { active: activeMap, spans: Array.from(spans) };
  }

  computeOverlap(info) {
    const active = info.active;
    const overlap = new Map();

    info.spans.forEach(span => overlap.set(span, new Set()));

    const add = (one, list) => {
      const set = overlap.get(one);
      list.forEach((other) => {
        if (other === one)
          return;
        set.add(other);
      });
    };

    active.forEach((spans) => {
      spans.forEach(span => add(span, spans));
    });

    return overlap;
  }

  color(spans, overlapMap) {
    let max = -1;
    const colors = new Map();

    const allocate = (span) => {
      if (colors.has(span))
        return colors.get(span);

      const overlap = overlapMap.get(span);

      // See which colors are already used
      const used = new Set();
      overlap.forEach((span) => {
        if (colors.has(span))
          used.add(colors.get(span));
      });

      // Find minimum available color
      let i;
      for (i = 0; i < max + 1; i++)
        if (!used.has(i))
          break;

      max = Math.max(max, i);
      colors.set(span, i);

      return i;
    };

    const res = new Map();

    spans.forEach(span => res.set(span, allocate(span)));

    const concurrency = new Array(max + 1);
    for (let i = 0; i < concurrency.length; i++)
      concurrency[i] = [];

    spans.forEach(span => concurrency[allocate(span)].push(span));

    return { map: res, concurrency, max };
  }
}
module.exports = Allocator;
