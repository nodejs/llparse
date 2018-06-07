import * as frontend from 'llparse-frontend';

import { IRBasicBlock, IRValue, ISwitchWeight } from '../compilation';
import { CONTAINER_KEY } from '../constants';
import { INodePosition, Node } from './base';
import { Transform } from '../transform';

export class Single extends Node<frontend.node.Single> {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    bb = this.prologue(bb, pos);

    const ctx = this.compilation;

    // Load the character
    let current: IRValue = bb.load(pos.current);

    // Transform the character
    current = this.applyTransform(this.ref.transform!, bb, current);

    // Mark error branches as unlikely
    const cases = this.ref.edges.map((edge) => {
      if (edge.node.ref instanceof frontend.node.Error) {
        return 'unlikely';
      } else {
        return 'likely';
      }
    });

    const weight: ISwitchWeight = {
      cases,
      otherwise: this.ref.otherwise!.node instanceof frontend.node.Error ?
        'unlikely' : 'likely',
    };

    const keys = this.ref.edges.map((edge) => edge.key);
    const s = ctx.switch(bb, current, keys, weight);

    s.cases.forEach((caseBB, i) => {
      const edge = this.ref.edges[i]!;

      this.tailTo(caseBB, edge, pos);
    });

    this.tailTo(s.otherwise, this.ref.otherwise!, pos);
  }
}
