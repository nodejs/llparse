import { IUniqueName } from '../utils';
import { Node } from './base';

export interface ISingleEdge {
  readonly key: number;
  readonly node: Node;
  readonly noAdvance: boolean;
}

export class Single extends Node {
  private readonly edges: ISingleEdge[] = [];

  constructor(id: IUniqueName) {
    super(id);
  }

  public addEdge(edge: ISingleEdge): void {
    this.edges.push(edge);
  }
}
