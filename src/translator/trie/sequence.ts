import { node as api } from 'llparse-builder';
import { TrieNode } from './node';

export class TrieSequence extends TrieNode {
  constructor(public readonly select: Buffer,
              public readonly child: TrieNode) {
    super();
  }
}
