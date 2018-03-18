import * as assert from 'assert';

import { IRBasicBlock, IRValue } from '../compilation';
import { GEP_OFF } from '../constants';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';
import { Error as ErrorNode } from './error';
import { Match } from './match';

const MAX_CHAR = 0xff;
const CELL_WIDTH = 8;

export interface ITableEdge {
  readonly keys: ReadonlyArray<number>;
  readonly node: Node;
  readonly noAdvance: boolean;
}

interface ITable {
  readonly global: IRValue;
  readonly nodeToIndex: ReadonlyMap<Node, number>;
}

export class TableLookup extends Match {
  protected readonly edges: ITableEdge[] = [];

  constructor(id: IUniqueName) {
    super(id);
  }

  public addEdge(edge: ITableEdge): void {
    this.edges.push(edge);
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    bb = this.prologue(bb, pos);

    const table = this.buildTable();
    const ctx = this.compilation;

    // Load the character
    let current: IRValue = bb.load(pos.current);

    // Transform the character
    current = this.transform!.build(ctx, bb, current);

    const cell = bb.load(
      bb.getelementptr(table.global, GEP_OFF.val(0), current, true));

    const nodes = Array.from(table.nodeToIndex.keys());
    const keys = Array.from(table.nodeToIndex.values());

    // TODO(indutny): de-duplicate this
    // Mark error branches as unlikely
    const cases = nodes.map((node) => {
      if (node instanceof ErrorNode) {
        return 'unlikely';
      } else {
        return 'likely';
      }
    });

    const s = ctx.switch(bb, cell, keys, {
      cases,
      otherwise: this.otherwise!.node instanceof ErrorNode ?
        'unlikely' : 'likely',
    });

    this.edges.forEach((edge, index) => {
      this.tailTo(s.cases[index], {
        noAdvance: edge.noAdvance,
        node: edge.node,
        value: undefined,
      }, pos);
    });

    this.tailTo(s.otherwise, this.otherwise!, pos);
  }

  private buildTable(): ITable {
    const table: number[] = new Array(MAX_CHAR + 1).fill(0);
    const nodeToIndex: Map<Node, number> = new Map();

    this.edges.forEach((edge) => {
      const index = nodeToIndex.size + 1;
      nodeToIndex.set(edge.node, index);

      edge.keys.forEach((key) => {
        assert.strictEqual(table[key], 0);
        table[key] = index;
      });
    });

    const ctx = this.compilation;

    const cellTy = ctx.ir.i(CELL_WIDTH);
    const array = ctx.ir.array(table.length, cellTy)
      .val(table.map((elem) => cellTy.val(elem)));

    return {
      global: ctx.addGlobalConst('lookup_table', array),
      nodeToIndex,
    };
  }
}
