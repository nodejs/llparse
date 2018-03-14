import { Code } from '../code';
import { Node } from './node';

export class SpanEnd extends Node {
  constructor(code: Code) {
    super('span_end_' + code.name, 'match');
  }
}
