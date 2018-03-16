import { IUniqueName } from '../utils';
import { Node } from './base';

export interface ITableEdge {
  readonly keys: ReadonlyArray<number>;
  readonly node: Node;
  readonly noAdvance: boolean;
}

export class TableLookup extends Node {
  protected readonly edges: ITableEdge[] = [];

  constructor(id: IUniqueName) {
    super(id);
  }

  public addEdge(edge: ITableEdge): void {
    this.edges.push(edge);
  }
}
