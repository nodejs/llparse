import { IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { Node } from './base';
import { Match } from './match';

export interface ISingleEdge {
  readonly key: number;
  readonly node: Node;
  readonly noAdvance: boolean;
}

export class Single extends Match {
  protected readonly edges: ISingleEdge[] = [];

  constructor(id: IUniqueName) {
    super(id);
  }

  public addEdge(edge: ISingleEdge): void {
    this.edges.push(edge);
  }

  protected doBuild(bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
