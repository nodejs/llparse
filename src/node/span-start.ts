import { Span } from '../code';
import { IUniqueName } from '../utils';
import { Node } from './base';

export class SpanStart extends Node {
  constructor(id: IUniqueName, public readonly span: any,
              private readonly callback: Span) {
    super(id);
  }
}
