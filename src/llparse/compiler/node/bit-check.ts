import { Buffer } from 'buffer';
import { Compilation, BasicBlock, INodeID } from '../compilation';
import { Node, INodeChild } from './base';

const CHAR_WIDTH = 8;
const WORD_WIDTH = 5;

export interface IBitCheckEntry {
  node: Node;
  noAdvance: boolean;
  keys: Buffer[];
}

export class BitCheck extends Node {
  public readonly entries: IBitCheckEntry[] = [];

  constructor(id: INodeID) {
    super('bit-check', id);
  }

  public add(entry: IBitCheckEntry): void {
    this.entries.push(entry);
  }

  public getChildren(): ReadonlyArray<INodeChild> {
    const res = super.getChildren();
    this.entries.forEach((entry) => {
      entry.keys.forEach((key) => {
        res.push({ node: entry.node, noAdvance: entry.noAdvance, key });
      });
    });
    return res;
  }

  private buildTable(ctx: Compilation) {
    const table = llparse.utils.buildLookupTable(WORD_WIDTH, CHAR_WIDTH,
      this.entries.map(entry => entry.keys));

    const cellTy = ctx.ir.i(1 << WORD_WIDTH);
    const arrayTy = ctx.ir.array(table.table.length, cellTy);

    const global = ctx.addGlobalConst('bit_check_table',
      arrayTy.val(table.table.map((elem) => cellTy.val(elem))));

    return {
      global,
      cellTy,

      indexShift: table.indexShift,
      shiftMask: table.shiftMask,
      shiftMul: table.shiftMul,
      valueMask: table.valueMask
    };
  }

  protected doBuild(ctx: Compilation, body: BasicBlock): void {
    const pos = ctx.pos.current;

    // Load the character
    let current = body.load(pos);

    // Transform the character if needed
    if (this.transform) {
      const res  = ctx.compilation.buildTransform(this.transform,
        body, current);
      body = res.body;
      current = res.current;
    }

    // Build global lookup table
    const table = this.buildTable(ctx);

    const cellTy = table.cellTy;

    const index = body.binop('lshr', current,
      pos.ty.toPointer().to.val(table.indexShift));

    let shift = body.binop('and', current,
      pos.ty.toPointer().to.val(table.shiftMask));
    shift = body.cast('zext', shift, cellTy);

    // Compiler can handle it, but why generate more code?
    if (table.shiftMul !== 1) {
      shift = body.binop('mul', shift, cellTy.val(table.shiftMul));
    }

    const ptr = body.getelementptr(table.global, ctx.INT.val(0),
      index, true);
    const load = body.load(ptr);

    const shr = body.binop('lshr', load, shift);
    const masked = body.binop('and', shr, cellTy.val(table.valueMask));

    const weights = new Array(this.entries.length + 1).fill('likely');

    this.entries.forEach((entry, i) => {
      if (entry.node instanceof node.Error)
        weights[i + 1] = 'unlikely';
    });

    if (this.otherwise instanceof node.Error)
      weights[0] = 'unlikely';

    const keys = this.entries.map((entry, i) => i + 1);
    const s = ctx.buildSwitch(body, masked, keys, weights);

    s.cases.forEach((body, i) => {
      const child = this.entries[i];

      this.tailTo(ctx, body, child.noAdvance ? ctx.pos.current : ctx.pos.next,
        child.node, null);
    });

    this.doOtherwise(ctx, s.otherwise);
  }
}
