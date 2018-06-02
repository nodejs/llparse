import { Span as SpanCallback } from './code';

export class Span {
  constructor(public readonly index: number,
              public readonly callbacks: ReadonlyArray<SpanCallback>) {
  }
}
