import { Code } from '../code';
import { Compilation } from '../compilation';
import { Node } from '../node';
import { Stage } from './base';

export type SpanID = Code;

interface IActiveResult {
  active: activeMap;
  spans: ReadonlyArray<SpanID>;
}

type OverlapMap = Map<SpanID, Set<SpanID> >;

export type ColoringMap = ReadonlyMap<SpanID, number>;

export interface IColoringResult {
  map: ColoringMap;
  concurrency: ReadonlyArray<number>;
  max: number;
}

export class Allocator extends Stage {
  constructor(ctx: Compilation) {
    super(ctx, 'span-allocator');
  }

  private id(node): SpanID {
    return node.code;
  }

  public build(): any {
    const root = this.ctx.stageResults['node-translator'].root;
    const nodes = this.getNodes(root);
    const info = this.computeActive(nodes);
    const overlap = this.computeOverlap(info);
    const color = this.color(info.spans, overlap);

    return color;
  }

  private getNodes(root: Node): ReadonlyArray<Node> {
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

  private computeActive(nodes: ReadonlyArray<Node>): IActiveResult {
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

  private computeOverlap(info: IActiveResult): OverlapMap {
    const active = info.active;
    const overlap: OverlapMap = new Map();

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

  private color(spans: ReadonlyArray<SpanID>, overlapMap: OverlapMap)
    : IColoringResult {
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

    const res: Map<SpanID, number> = new Map();

    spans.forEach(span => res.set(span, allocate(span)));

    const concurrency = new Array(max + 1);
    for (let i = 0; i < concurrency.length; i++)
      concurrency[i] = [];

    spans.forEach(span => concurrency[allocate(span)].push(span));

    return { map: res, concurrency, max };
  }
}
