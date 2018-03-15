import * as assert from 'assert';
import { node as api, Span } from 'llparse-builder';

type SpanSet = Set<Span>;

interface ISpanActiveInfo {
  readonly active: Map<api.Node, SpanSet>;
  readonly spans: ReadonlyArray<Span>;
}

type SpanOverlap = Map<Span, SpanSet>;

export interface ISpanAllocatorResult {
  readonly colors: ReadonlyMap<Span, number>;
  readonly concurrency: ReadonlyArray<ReadonlyArray<Span> >;
  readonly max: number;
}

function id(node: api.SpanStart | api.SpanEnd): Span {
  return node.span;
}

export class SpanAllocator {
  public allocate(root: api.Node): ISpanAllocatorResult {
    const nodes = this.getNodes(root);
    const info = this.computeActive(nodes);
    const overlap = this.computeOverlap(info);
    return this.color(info.spans, overlap);
  }

  private getNodes(root: api.Node): ReadonlyArray<api.Node> {
    const res = new Set();
    const queue = [ root ];
    while (queue.length !== 0) {
      const node = queue.pop()!;
      if (res.has(node)) {
        continue;
      }
      res.add(node);

      for (const edge of node) {
        queue.push(edge.node);
      }

      const otherwise = node.getOtherwiseEdge();
      if (otherwise !== undefined) {
        queue.push(otherwise.node);
      }
    }
    return Array.from(res);
  }

  private computeActive(nodes: ReadonlyArray<api.Node>): ISpanActiveInfo {
    const activeMap: Map<api.Node, SpanSet> = new Map();
    nodes.forEach((node) => activeMap.set(node, new Set()));

    const queue: Set<api.Node> = new Set(nodes);
    const spans: SpanSet = new Set();
    for (const node of queue) {
      queue.delete(node);

      const active = activeMap.get(node)!;

      if (node instanceof api.SpanStart) {
        const span = id(node);
        spans.add(span);
        active.add(span);
      }

      active.forEach((span) => {
        // Don't propagate span past the spanEnd
        if (node instanceof api.SpanEnd && span === id(node)) {
          return;
        }

        const edges = Array.from(node);
        const otherwise = node.getOtherwiseEdge();
        if (otherwise !== undefined) {
          edges.push(otherwise);
        }

        edges.forEach((edge) => {
          const edgeNode = edge.node;

          // Disallow loops
          if (edgeNode instanceof api.SpanStart) {
            assert.notStrictEqual(id(edgeNode), span,
              `Detected loop in span "${span.callback.name}"`);
          }

          const edgeActive = activeMap.get(edgeNode)!;
          if (edgeActive.has(span)) {
            return;
          }

          edgeActive.add(span);
          queue.add(edgeNode);
        });
      });
    }

    const ends: api.SpanEnd[] = nodes
      .filter((node) => node instanceof api.SpanEnd)
      .map((node) => node as api.SpanEnd);

    ends.forEach((end) => {
      const active = activeMap.get(end)!;
      assert(active.has(id(end)),
        `Unmatched span end for "${id(end).callback.name}"`);
    });

    return { active: activeMap, spans: Array.from(spans) };
  }

  private computeOverlap(info: ISpanActiveInfo): SpanOverlap {
    const active = info.active;
    const overlap: SpanOverlap = new Map();

    info.spans.forEach((span) => overlap.set(span, new Set()));

    active.forEach((spans) => {
      spans.forEach((one) => {
        const set = overlap.get(one)!;
        spans.forEach((other) => {
          if (other !== one) {
            set.add(other);
          }
        });
      });
    });

    return overlap;
  }

  private color(spans: ReadonlyArray<Span>, overlapMap: SpanOverlap)
    : ISpanAllocatorResult {
    let max = -1;
    const colors: Map<Span, number> = new Map();

    const allocate = (span: Span): number => {
      if (colors.has(span)) {
        return colors.get(span)!;
      }

      const overlap = overlapMap.get(span)!;

      // See which colors are already used
      const used: Set<number> = new Set();
      for (const subSpan of overlap) {
        if (colors.has(subSpan)) {
          used.add(colors.get(subSpan)!);
        }
      }

      // Find minimum available color
      let i;
      for (i = 0; used.has(i); i++) {
        // no-op
      }

      max = Math.max(max, i);
      colors.set(span, i);

      return i;
    };

    const map: Map<Span, number> = new Map();

    spans.forEach((span) => map.set(span, allocate(span)));

    const concurrency: Span[][] = new Array(max + 1);
    for (let i = 0; i < concurrency.length; i++) {
      concurrency[i] = [];
    }

    spans.forEach((span) => concurrency[allocate(span)].push(span));

    return { colors: map, concurrency, max };
  }
}
