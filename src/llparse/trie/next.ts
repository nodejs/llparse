import { Node } from '../node';
import { TrieNode } from './node';

export class TrieNext extends TrieNode {
  constructor(value: number | undefined, public readonly next: Node) {
    super('sequence');
    this.value = value;
  }
}
