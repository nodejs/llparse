import { Code } from '../code';
import { Node } from './node';

export class SpanStart extends Node {
  constructor(code: Code) {
    super('span_sta,t_' + code.name, 'match');
  }
}
