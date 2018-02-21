'use strict';

const assert = require('assert');

const llparse = require('../../');
const kType = llparse.symbols.kType;

const node = require('./');

class Invoke extends node.Node {
  constructor(name, code, map) {
    super('invoke', name);

    this.code = code;
    this.map = map;
  }

  prologue(ctx, body) {
    return body;
  }

  doBuild(ctx, body, nodes) {
    body.comment(`node.Invoke[${this.code.name}]`);
    const code = ctx.compilation.buildCode(this.code);

    const args = [
      ctx.state,
      ctx.pos.current,
      ctx.endPos
    ];

    if (this.code[kType] === 'value')
      args.push(ctx.match);
    else
      assert.strictEqual(this.code[kType], 'match');

    const call = ctx.call('', code.type, code, args);
    body.push(call);

    const keys = Object.keys(this.map).map(key => key | 0);
    const s = ctx.buildSwitch(body, code.type.ret, call, keys);

    s.cases.forEach((body, i) => {
      const child = info.node.map[keys[i]].build(ctx.compilation, nodes);

      this.tailTo(ctx, body, ctx.pos.next, child, this.children[i].value);
    });

    this.doOtherwise(ctx, nodes, s.otherwise);
  }
}
module.exports = Invoke;
