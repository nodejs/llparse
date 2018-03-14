import * as assert from 'assert';

import { Code } from './code';
import { Node, SpanStart, SpanEnd } from './node';

export class Span {
  private readonly startCache: Map<Node, SpanStart> = new Map();
  private readonly endCache: Map<Node, SpanEnd> = new Map();

  constructor(public readonly code: Code) {
  }

  public start(otherwise?: Node): SpanStart {
    if (otherwise !== undefined && this.startCache.has(otherwise)) {
      return this.startCache.get(otherwise)!;
    }

    const res = new SpanStart(this.code);
    if (otherwise !== undefined) {
      res.otherwise(otherwise);
      this.startCache.set(otherwise, res);
    }
    return res;
  }

  public end(otherwise?: Node): SpanEnd {
    if (otherwise !== undefined && this.endCache.has(otherwise)) {
      return this.endCache.get(otherwise)!;
    }

    const res = new SpanEnd(this[kCode]);
    if (otherwise !== undefined) {
      res.otherwise(otherwise);
      cache.set(otherwise, res);
    }
    return res;
  }
}
