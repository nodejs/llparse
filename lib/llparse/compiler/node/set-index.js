'use strict';

const assert = require('assert');

const llparse = require('../../');
const kSignature = llparse.symbols.kSignature;

const node = require('./');

class SetIndex extends node.Node {
  constructor(id, code) {
    super('set-index', id);

    this.code = code;
    this.noPrologueCheck = true;
  }

  doBuild(ctx, body) {
    const code = ctx.compilation.buildCode(this.code);

    const args = [
      ctx.state,
      ctx.pos.current,
      ctx.endPos
    ];

    assert.strictEqual(this.code[kSignature], 'match');
    const call = body.call(code, args);

    const ptr = ctx.stateField(body, '_index');
    body.store(call, ptr)
      .metadata.set('invariant.group', ctx.INVARIANT_GROUP);

    this.doOtherwise(ctx, body);
  }
}
module.exports = SetIndex;
