import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import { IRBasicBlock, IRValue } from '../compilation';
import { GEP_OFF } from '../constants';
import { INodePosition, Node } from './base';

const MAX_CHAR = 0xff;
const CELL_WIDTH = 8;

interface ITable {
  readonly global: IRValue;
  readonly nodeToIndex: ReadonlyMap<frontend.IWrap<frontend.node.Node>, number>;
}

export class TableLookup extends Node<frontend.node.TableLookup> {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    bb = this.prologue(bb, pos);

    const table = this.buildTable();
    const ctx = this.compilation;

    // Load the character
    let current: IRValue = bb.load(pos.current);

    // Transform the character
    current = this.applyTransform(this.ref.transform!, bb, current);

    // Extend character to prevent signed problems
    current = ctx.truncate(bb, current, GEP_OFF);

    const cell = bb.load(
      bb.getelementptr(table.global, GEP_OFF.val(0), current, true));

    cell.metadata.set('range', ctx.ir.metadata([
      ctx.ir.metadata(cell.ty.toInt().val(0)),
      ctx.ir.metadata(cell.ty.toInt().val(table.nodeToIndex.size + 1)),
    ]));

    const nodes = Array.from(table.nodeToIndex.keys());
    const keys = Array.from(table.nodeToIndex.values());

    // TODO(indutny): de-duplicate this
    // Mark error branches as unlikely
    const cases = nodes.map((node) => {
      if (node.ref instanceof frontend.node.Error) {
        return 'unlikely';
      } else {
        return 'likely';
      }
    });

    const s = ctx.switch(bb, cell, keys, {
      cases,
      otherwise: this.ref.otherwise!.node.ref instanceof frontend.node.Error ?
        'unlikely' : 'likely',
    });

    this.ref.edges.forEach((edge, index) => {
      this.tailTo(s.cases[index], {
        noAdvance: edge.noAdvance,
        node: edge.node,
        value: undefined,
      }, pos);
    });

    this.tailTo(s.otherwise, this.ref.otherwise!, pos);
  }

  // TODO(indutny): reduce copy-paste between `C` and `bitcode` implementations
  private buildTable(): ITable {
    const table: number[] = new Array(MAX_CHAR + 1).fill(0);
    const nodeToIndex: Map<frontend.IWrap<frontend.node.Node>, number> =
        new Map();

    this.ref.edges.forEach((edge) => {
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
