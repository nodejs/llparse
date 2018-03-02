'use strict';

const node = require('./');

const INDEX_SHIFT = 5;
const CELL_WIDTH = 1 << INDEX_SHIFT;
const OFF_MASK = CELL_WIDTH - 1;

class Check extends node.Node {
  constructor(id, keys) {
    super('check', id);

    this.keys = keys;
    this.next = null;
  }

  getChildren() {
    return super.getChildren().concat(this.keys.map((key) => {
      return { node: this.next.node, noAdvance: this.next.noAdvance, key };
    }));
  }

  buildTable(ctx) {
    // TODO(indutny): 64-bit table through BN support?
    // 8 x i32
    const table = new Array(256 / CELL_WIDTH).fill(0);

    this.keys.forEach((key) => {
      const bit = 1 << (key & OFF_MASK);
      const index = key >> INDEX_SHIFT;
      table[index] |= bit;
    });

    return ctx.ir.array(ctx.ir.i(CELL_WIDTH).array(table.length),
      table.map(t => t >>> 0));
  }

  doBuild(ctx, body) {
    body.comment('node.Check');

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

    const cellType = table.type.to.of;

    body.comment('compute index');
    const index = ctx.ir._('lshr', [ pos.type.to, current ],
      pos.type.to.v(INDEX_SHIFT));
    body.push(index);

    body.comment('compute off');
    let off = ctx.ir._('and', [ pos.type.to, current ],
      pos.type.to.v(OFF_MASK));
    body.push(off);
    off = ctx.ir._('zext', [ pos.type.to, off, 'to', cellType ]);
    body.push(off);
    off = ctx.ir._('shl', [ cellType, cellType.v(1) ], off);
    body.push(off);

    body.comment('l = table[index]');
    const ptr = ctx.ir._('getelementptr inbounds', table.type.to,
      [ table.type, table ],
      [ pos.type.to, pos.type.to.v(0) ],
      [ pos.type.to, index ]);
    body.push(ptr);
    const load = ctx.ir._('load', cellType, [ cellType.ptr(), ptr ]);
    body.push(load);

    body.comment('if (l & off)');
    const and = ctx.ir._('and', [ cellType, load ], off);
    body.push(and);
    const cmp = ctx.ir._('icmp', [ 'ne', cellType, and ], cellType.v(0));
    body.push(cmp);

    const weights = [ 'likely', 'likely' ];
    if (this.otherwise instanceof node.Error)
      weights[1] = 'unlikely';

    const branch = ctx.branch(body, cmp, weights);

    this.tailTo(ctx, branch.left,
      this.next.noAdvance ? ctx.pos.current : ctx.pos.next,
      this.next.node, null);

    this.doOtherwise(ctx, branch.right);
  }
}
module.exports = Check;
