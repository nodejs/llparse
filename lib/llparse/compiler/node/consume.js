'use strict';

const assert = require('assert');

const node = require('./');

class Consume extends node.Node {
  constructor(...args) {
    super('consume', ...args);
    this.noPrologueCheck = true;
  }

  // TODO(indutny): remove unnecessary load
  doBuild(ctx, body) {
    const INVARIANT_GROUP = ctx.INVARIANT_GROUP;

    const pos = ctx.pos.current;

    const indexPtr = ctx.stateField(body, '_index');
    const index = body.load(indexPtr);
    index.metadata.set('invariant.group', INVARIANT_GROUP);

    const need = body.cast('zext', index, ctx.TYPE_INTPTR);

    const intPos = body.cast('ptrtoint', pos, ctx.TYPE_INTPTR);
    const intEndPos = body.cast('ptrtoint', ctx.endPos, ctx.TYPE_INTPTR);

    const avail = body.binop('sub', intEndPos, intPos);
    const cmp = body.icmp('uge', avail, need);
    const branch = ctx.branch(body, cmp, [ 'likely', 'unlikely' ]);

    const hasData = branch.left;
    const noData = branch.right;
    hasData.name = 'has_data';
    noData.name = 'no_data';

    // Continue!
    const next = hasData.getelementptr(pos, index);

    assert(!this.skip);
    hasData.store(ctx.TYPE_INDEX.val(0), indexPtr)
      .metadata.set('invariant.group', INVARIANT_GROUP);
    this.doOtherwise(ctx, hasData, { current: next, next: null });

    // Pause!
    const left = noData.binop('sub', need, avail);

    const leftTrunc = noData.cast('trunc', left, ctx.TYPE_INDEX);

    noData.store(leftTrunc, indexPtr)
      .metadata.set('invariant.group', INVARIANT_GROUP);
    this.pause(ctx, noData);
  }
}
module.exports = Consume;
