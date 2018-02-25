'use strict';

const assert = require('assert');

const llparse = require('../../');
const kType = llparse.symbols.kType;

const node = require('./');

class SetIndex extends node.Node {
  constructor(id, code) {
    super('set-index', id);

    this.code = code;
  }

  prologue(ctx, body) {
    return body;
  }

  doBuild(ctx, body, nodes) {
    const INVARIANT_GROUP = ctx.INVARIANT_GROUP;

    body.comment(`node.SetIndex[${this.code.name}]`);

    const code = ctx.compilation.buildCode(this.code);

    const args = [
      ctx.state,
      ctx.pos.current,
      ctx.endPos
    ];

    assert.strictEqual(this.code[kType], 'match');
    const call = ctx.call('', code.type, code, args);
    body.push(call);

    const ptr = ctx.field('_index');
    body.push(ptr);
    body.push(ctx.ir._('store', [ ctx.TYPE_INDEX, call ],
      [ ctx.TYPE_INDEX.ptr(), ptr ],
      [ '!invariant.group', INVARIANT_GROUP ]).void());

    this.doOtherwise(ctx, nodes, body);
  }
}
module.exports = SetIndex;
