import { node as api } from 'llparse-builder';
import { TrieNode } from './node';

export interface ITrieSingleChild {
  key: number;
  noAdvance: boolean;
  node: TrieNode;
}

export class TrieSingle extends TrieNode {
  constructor(public readonly children: ReadonlyArray<ITrieSingleChild>) {
    super();
  }
}
