import { node as api } from 'llparse-builder';
import { TrieNode } from './node';

export class TrieEmpty extends TrieNode {
  constructor(public readonly node: api.Node,
              public readonly value: number | undefined) {
    super();
  }
}
