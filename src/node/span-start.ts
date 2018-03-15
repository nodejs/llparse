import { Span } from '../span';
import { IUniqueName } from '../utils';
import { Node } from './base';

export class SpanStart extends Node {
  constructor(id: IUniqueName, private readonly span: Span) {
    super(id);
  }
}
