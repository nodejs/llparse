import * as assert from 'assert';
import { Node } from './node';

export class Consume extends Node {
  constructor(public readonly fieldName: string) {
    super('consume_' + fieldName, 'match');

    assert(!/^_/.test(fieldName), 'Can\'t use internal field name in Consume');
  }
}
