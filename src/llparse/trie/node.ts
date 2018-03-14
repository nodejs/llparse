export type NodeType = 'single' | 'sequence' | 'next';

export class TrieNode {
  public value: number | undefined;

  constructor(public readonly type: NodeType) {
  }
}
