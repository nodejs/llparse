import { TrieNode } from './node';

export interface ITrieSingleChild {
  child: TrieNode;
  key: number;
  noAdvance: boolean;
}

export class TrieSingle extends TrieNode {
  public readonly children: ITrieSingleChild[] = [];

  constructor() {
    super('single');
  }
}
