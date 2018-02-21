'use strict';

const assert = require('assert')

const node = require('./');
const llparse = require('../../');
const constants = llparse.constants;

class NodeContext {
  constructor(ctx, fn) {
    this.compilation = ctx;
    this.fn = fn;

    this.state = this.compilation.stateArg(this.fn);
    this.pos = {
      current: this.compilation.posArg(this.fn),
      next: null
    };
    this.endPos = this.compilation.endPosArg(this.fn);
    this.match = this.compilation.matchArg(this.fn);

    // Re-export some properties
    this.ir = this.compilation.ir;
    this.signature = this.compilation.signature;
    this.stateType = this.compilation.state;

    // Some generally useful types (to avoid unnecessary includes)
    this.INT = constants.INT;
    this.BOOL = constants.BOOL;
    this.TYPE_MATCH = constants.TYPE_MATCH;
    this.TYPE_REASON = constants.TYPE_REASON;
    this.TYPE_ERROR = constants.TYPE_ERROR;
  }

  // Just proxy
  field(name) {
    return this.compilation.field(this.fn, name);
  }

  call(...args) { return this.compilation.call(...args); }
  buildSwitch(...args) { return this.compilation.buildSwitch(...args); }
}

class Node {
  constructor(type, name) {
    this.type = type;
    this.name = name;
    this.otherwise = null;
    this.skip = false;

    this.fn = null;
    this.phis = new Map();
  }

  setOtherwise(otherwise, skip) {
    this.otherwise = otherwise;
    this.skip = skip;
  }

  build(compilation, nodes) {
    if (nodes.has(this))
      return nodes.get(this);

    const fn = compilation.fn(compilation.signature.node, this.name);
    const ctx = new NodeContext(compilation, fn);

    // Errors are assumed to be rarely called
    // TODO(indutny): move this to node.Error somehow?
    if (this instanceof node.Error) {
      fn.attributes = fn.attributes || '';
      fn.attributes += ' cold writeonly';
    }

    nodes.set(this, fn);

    let body = fn.body;
    body = this.prologue(ctx, body);

    body.comment('next = pos + 1');
    ctx.pos.next = ctx.ir._('getelementptr', ctx.pos.current.type.to,
      [ ctx.pos.current.type, ctx.pos.current ],
      [ ctx.INT, ctx.INT.v(1) ]);
    body.push(ctx.pos.next);

    this.doBuild(ctx, body, nodes);

    return fn;
  }

  prologue(ctx, body) {
    const pos = ctx.pos.current;
    const endPos = ctx.endPos;

    // Check that we have enough chars to do the read
    body.comment('--- Prologue ---');
    body.comment('if (pos != endpos)');
    const cmp = ctx.ir._('icmp', [ 'ne', pos.type, pos ], endPos);
    body.push(cmp);

    const branch = body.branch('br', [ ctx.BOOL, cmp ]);

    // Return self when `pos === endpos`
    branch.right.name = 'no_data';
    this.pause(ctx, branch.right);

    branch.left.name = 'has_data';
    return branch.left;
  }

  pause(ctx, body) {
    const fn = ctx.fn;
    const bitcast = ctx.ir._('bitcast',
      [ fn.type.ptr(), fn, 'to', fn.type.ret ]);
    body.push(bitcast);
    body.terminate('ret', [ fn.type.ret, bitcast ]);
  }

  tailTo(ctx, body, pos, target, value = null) {
    if (this.phis.has(target)) {
      const cached = this.phis.get(target);

      if (cached.phi) {
        assert(value,  '`.match()` and `.select()` with the same target');
        cached.phi.append(
          [ '[', ctx.TYPE_MATCH.v(value), ',', body.ref(), ']' ]);
      } else {
        assert(!value,  '`.match()` and `.select()` with the same target');
      }

      body.terminate('br', cached.trampoline);
      return;
    }

    // Split, so that others could join us from code block above
    const trampoline = body.jump('br');
    trampoline.name = body.name + '_trampoline';
    let phi = null;

    // Compute `match` if needed
    if (value !== null) {
      trampoline.comment('Select `match`');
      phi = ctx.ir._('phi',
        [ ctx.TYPE_MATCH, '[', ctx.TYPE_MATCH.v(value), ',', body.ref(), ']' ]);
      trampoline.push(phi);
    }

    this.phis.set(target, { phi, trampoline });

    // TODO(indutny): looks like `musttail` gives worse performance when calling
    // Invoke nodes (possibly others too).
    const call = ctx.call('musttail', ctx.signature.node, target, [
      ctx.state,
      pos,
      ctx.endPos,
      phi ? phi : ctx.TYPE_MATCH.v(0)
    ]);

    trampoline.push(call);
    trampoline.terminate('ret', [ ctx.fn.type.ret, call ]);
  }

  doBuild() {
    throw new Error('Not implemented');
  }

  doOtherwise(ctx, nodes, body, pos) {
    if (!pos)
      pos = ctx.pos;

    // `.skipTo()` advances by one byte
    // `.otherwise()` redirects using the same byte
    const next = this.skip ? pos.next : pos.current;

    assert(this.otherwise);
    this.tailTo(ctx, body, next, this.otherwise.build(ctx.compilation, nodes));
  }
}
module.exports = Node;
