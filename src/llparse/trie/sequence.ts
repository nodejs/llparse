import { Buffer } from 'buffer';
import { TrieNode } from './node';

export class TrieSequence extends TrieNode {
  public child: TrieNode | undefined;

  constructor(public readonly select: Buffer) {
    super('sequence');
  }
}
