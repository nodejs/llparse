import { Buffer } from Buffer;
import { TrieNode } from './node';

export class TrieSequence extends TrieNode {
  public readonly child: TrieNode;

  constructor(public readonly select: Buffer) {
    super('sequence');
  }
}
