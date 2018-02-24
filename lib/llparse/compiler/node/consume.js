'use strict';

const assert = require('assert');

const node = require('./');

class Consume extends node.Node {
  constructor(name) {
    super('consume', name);
  }

  prologue(ctx, body) {
    return body;
  }

  // TODO(indutny): remove unnecessary load
  doBuild(ctx, body, nodes) {
    body.comment('node.Consume');

    const pos = ctx.pos.current;

    body.comment('index = state.index');
    const indexPtr = ctx.field('_index');
    body.push(indexPtr);
    const index = ctx.ir._('load', ctx.TYPE_INDEX,
      [ ctx.TYPE_INDEX.ptr(), indexPtr ]);
    body.push(index);

    const need = ctx.ir._('zext',
      [ ctx.TYPE_INDEX, index, 'to', ctx.TYPE_INTPTR ]);
    body.push(need);

    body.comment('avail = endp - p');
    const intPos = ctx.ir._('ptrtoint',
      [ pos.type, pos, 'to', ctx.TYPE_INTPTR ]);
    body.push(intPos);
    const intEndPos = ctx.ir._('ptrtoint',
      [ pos.type, ctx.endPos, 'to', ctx.TYPE_INTPTR ]);
    body.push(intEndPos);

    const avail = ctx.ir._('sub', [ ctx.TYPE_INTPTR, intEndPos ], intPos);
    body.push(avail);

    body.comment('if (avail >= need)');
    const cmp = ctx.ir._('icmp', [ 'uge', ctx.TYPE_INTPTR, avail ], need);
    body.push(cmp);
    const branch = body.branch('br', [ ctx.BOOL, cmp ]);

    const hasData = branch.left;
    const noData = branch.right;
    hasData.name = 'has_data';
    noData.name = 'no_data';

    // Continue!
    const next = ctx.ir._('getelementptr', pos.type.to,
      [ pos.type, pos ],
      [ ctx.TYPE_INDEX, index ]);
    hasData.push(next);

    assert(!this.skip);
    hasData.comment('state.index = 0');
    hasData.push(ctx.ir._('store', [ ctx.TYPE_INDEX, ctx.TYPE_INDEX.v(0) ],
      [ ctx.TYPE_INDEX.ptr(), indexPtr ]).void());
    this.doOtherwise(ctx, nodes, hasData, { current: next, next: null });

    // Pause!
    noData.comment('state.index = need - avail');
    const left = ctx.ir._('sub', [ ctx.TYPE_INTPTR, need ], avail);
    noData.push(left);

    const leftTrunc = ctx.ir._('trunc',
      [ ctx.TYPE_INTPTR, left, 'to', ctx.TYPE_INDEX ]);
    noData.push(leftTrunc);

    noData.push(ctx.ir._('store', [ ctx.TYPE_INDEX, leftTrunc ],
      [ ctx.TYPE_INDEX.ptr(), indexPtr ]).void());
    this.pause(ctx, noData);
  }
}
module.exports = Consume;
