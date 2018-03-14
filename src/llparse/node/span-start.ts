import { Code } from '../code';
import { Node } from './node';

export class SpanStart extends Node {
  constructor(public readonly code: Code) {
    super('span_start_' + code.name, 'match');
  }
}
