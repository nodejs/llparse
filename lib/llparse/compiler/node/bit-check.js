'use strict';

const node = require('./');
const llparse = require('../../');

const CHAR_WIDTH = 8;
const WORD_WIDTH = 5;

class BitCheck extends node.Node {
  constructor(id) {
    super('bit-check', id);

    this.map = null;
  }

  getChildren() {
    const res = super.getChildren();
    this.map.forEach((entry) => {
      entry.keys.forEach((key) => {
        res.push({ node: entry.node, noAdvance: entry.noAdvance, key });
      });
    });
    return res;
  }

  buildTable(ctx) {
    const table = llparse.utils.buildLookupTable(WORD_WIDTH, CHAR_WIDTH,
      this.map.map(entry => entry.keys));

    const arrayTy = ctx.ir.i(1 << WORD_WIDTH).array(table.table.length);

    return {
      global: ctx.ir.array(arrayTy, table.table),

      indexShift: table.indexShift,
      shiftMask: table.shiftMask,
      shiftMul: table.shiftMul,
      valueMask: table.valueMask
    };
  }

  doBuild(ctx, body) {
    body.comment('node.BitCheck');

    const pos = ctx.pos.current;

    // Load the character
    let current = ctx.ir._('load', pos.type.to, [ pos.type, pos ]);
    body.push(current);

    // Transform the character if needed
    if (this.transform) {
      const res  = ctx.compilation.buildTransform(this.transform,
        body, current);
      body = res.body;
      current = res.current;
    }

    // Build global lookup table
    const table = this.buildTable(ctx);

    const cellType = table.global.type.to.of;

    body.comment('compute index');
    const index = ctx.ir._('lshr', [ pos.type.to, current ],
      pos.type.to.v(table.indexShift));
    body.push(index);

    body.comment('compute shift');
    let shift = ctx.ir._('and', [ pos.type.to, current ],
      pos.type.to.v(table.shiftMask));
    body.push(shift);
    shift = ctx.ir._('zext', [ pos.type.to, shift, 'to', cellType ]);
    body.push(shift);

    // Compiler can handle it, but why generate more code?
    if (table.shiftMul !== 1) {
      shift = ctx.ir._('mul', [ cellType, shift ], cellType.v(table.shiftMul));
      body.push(shift);
    }

    body.comment('l = table[index]');
    const ptr = ctx.ir._('getelementptr inbounds', table.global.type.to,
      [ table.global.type, table.global ],
      [ pos.type.to, pos.type.to.v(0) ],
      [ pos.type.to, index ]);
    body.push(ptr);
    const load = ctx.ir._('load', cellType, [ cellType.ptr(), ptr ]);
    body.push(load);

    body.comment('l >>= shift');
    const shr = ctx.ir._('lshr', [ cellType, load ], shift);
    body.push(shr);

    body.comment('l &= valueMask');
    const masked = ctx.ir._('and', [ cellType, shr ],
      cellType.v(table.valueMask));
    body.push(masked);

    const weights = new Array(this.map.length + 1).fill('likely');

    this.map.forEach((entry, i) => {
      if (entry.node instanceof node.Error)
        weights[i + 1] = 'unlikely';
    });

    if (this.otherwise instanceof node.Error)
      weights[0] = 'unlikely';

    const keys = this.map.map((entry, i) => i + 1);
    const s = ctx.buildSwitch(body, cellType, masked, keys, weights);

    s.cases.forEach((body, i) => {
      const child = this.map[i];

      this.tailTo(ctx, body, child.noAdvance ? ctx.pos.current : ctx.pos.next,
        child.node, null);
    });

    this.doOtherwise(ctx, s.otherwise);
  }
}
module.exports = BitCheck;
