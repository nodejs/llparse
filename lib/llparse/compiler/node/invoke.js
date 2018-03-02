'use strict';

const assert = require('assert');

const llparse = require('../../');
const kSignature = llparse.symbols.kSignature;

const node = require('./');

class Invoke extends node.Node {
  constructor(id, code) {
    super('invoke', id);

    this.code = code;
    this.map = null;
  }

  getChildren() {
    return super.getChildren().concat(Object.keys(this.map).map((key) => {
      return { node: this.map[key], noAdvance: true, key: null };
    }));
  }

  prologue(ctx, body) {
    return body;
  }

  doBuild(ctx, body) {
    body.comment(`node.Invoke[${this.code.name}]`);
    const code = ctx.compilation.buildCode(this.code);

    const args = [
      ctx.state,
      ctx.pos.current,
      ctx.endPos
    ];

    if (this.code[kSignature] === 'value')
      args.push(ctx.match);
    else
      assert.strictEqual(this.code[kSignature], 'match');

    const call = ctx.call('', code.type, code, args);
    body.push(call);

    const keys = Object.keys(this.map).map(key => key | 0);
    const s = ctx.buildSwitch(body, code.type.ret, call, keys);

    s.cases.forEach((body, i) => {
      this.tailTo(ctx, body, ctx.pos.current, this.map[keys[i]]);
    });

    this.doOtherwise(ctx, s.otherwise);
  }
}
module.exports = Invoke;
