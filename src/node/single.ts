import { IRBasicBlock, IRValue, ISwitchWeight } from '../compilation';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';
import { Error as ErrorNode } from './error';
import { Match } from './match';

export interface ISingleEdge {
  readonly key: number;
  readonly node: Node;
  readonly noAdvance: boolean;
  readonly value: number | undefined;
}

export class Single extends Match {
  protected readonly edges: ISingleEdge[] = [];

  constructor(id: IUniqueName) {
    super(id);
  }

  public addEdge(edge: ISingleEdge): void {
    this.edges.push(edge);
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    bb = this.prologue(bb, pos);

    const ctx = this.compilation;

    // Load the character
    let current: IRValue = bb.load(pos.current);

    // Transform the character
    current = this.transform!.build(ctx, bb, current);

    // Mark error branches as unlikely
    const cases = this.edges.map((edge, i) => {
      if (edge.node instanceof ErrorNode) {
        return 'unlikely';
      } else {
        return 'likely';
      }
    });

    const weight: ISwitchWeight = {
      cases,
      otherwise: this.otherwise!.node instanceof ErrorNode ?
        'unlikely' : 'likely',
    };

    const keys = this.edges.map((edge) => edge.key);
    const s = ctx.switch(bb, current, keys, weight);

    s.cases.forEach((caseBB, i) => {
      const edge = this.edges[i]!;

      this.tailTo(caseBB, edge, pos);
    });

    this.tailTo(s.otherwise, this.otherwise!, pos);
  }
}
