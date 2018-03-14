import { Node } from '../node';
import { TrieNode } from './node';

export class TrieNext extends TrieNode {
  constructor(public readonly value?: number,
              public readonly next: Node) {
    super('sequence');
  }
}
