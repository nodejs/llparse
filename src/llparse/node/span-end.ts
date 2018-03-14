import { Code } from '../code';
import { Node } from './node';

export class SpanEnd extends Node {
  constructor(public readonly code: Code) {
    super('span_end_' + code.name, 'match');
  }
}
