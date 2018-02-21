'use strict';

const IR = require('llvm-ir');

const node = require('./');
const llparse = require('../../');
const constants = llparse.constants;

const ARG_STATE = constants.ARG_STATE;
const ARG_POS = constants.ARG_POS;
const ARG_ENDPOS = constants.ARG_ENDPOS;
const ARG_MATCH = constants.ARG_MATCH;

class NodeContext {
  constructor(ctx, fn) {
    this.ctx = ctx;
    this.fn = fn;

    // Re-export some properties
    this.ir = ctx.ir;
    this.signature = ctx.signature;
    this.stateType = ctx.state;

    // Some generally useful types (to avoid unnecessary includes)
    this.INT = constants.INT;
    this.BOOL = constants.BOOL;
    this.TYPE_MATCH = constants.TYPE_MATCH;
    this.TYPE_REASON = constants.TYPE_REASON;
  }

  field(name) {
    return this.ctx.field(fn, name);
  }

  state() { return this.fn.arg(ARG_STATE); }
  pos() { return this.fn.arg(ARG_POS); }
  endPos() { return this.fn.arg(ARG_ENDPOS); }
  match() { return this.fn.arg(ARG_MATCH); }

  // Just proxy
  call(...args) { return this.ctx.call(...args); }
  buildSwitch(...args) { return this.ctx.buildSwitch(...args); }
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

  build(ctx, nodes) {
    if (nodes.has(this))
      return nodes.get(this);

    const fn = ctx.fn(ctx.signature.node, this.name);
    const nctx = new NodeContext(ctx, fn);

    // Errors are assumed to be rarely called
    if (this instanceof node.Error)
      fn.attributes += ' cold writeonly';

    nodes.set(this, fn);

    const body = this.prologue(nctx, fn.body);
    this.doBuild(nctx, body, nodes);

    return fn;
  }

  prologue(ctx, body) {
    const pos = ctx.pos();
    const endPos = ctx.endPos();

    // Check that we have enough chars to do the read
    body.comment('--- Prologue ---');
    body.comment('if (pos != endpos)');
    const cmp = IR._('icmp', [ 'ne', pos.type, pos ], endPos);
    body.push(cmp);

    const branch = body.branch('br', [ ctx.BOOL, cmp ]);

    // Return self when `pos === endpos`
    branch.right.name = 'prologue_end';
    this.pause(ctx, branch.right);

    branch.left.name = 'prologue_normal';
    return branch.left;
  }

  pause(ctx, body) {
    const fn = ctx.fn;
    const bitcast = IR._('bitcast', [ fn.type.ptr(), fn, 'to', fn.type.ret ]);
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
      phi = IR._('phi',
        [ TYPE_MATCH, '[', TYPE_MATCH.v(value), ',', body.ref(), ']' ]);
      trampoline.push(phi);
    }

    this.phis.set(target, { phi, trampoline });

    // TODO(indutny): looks like `musttail` gives worse performance when calling
    // Invoke nodes (possibly others too).
    const call = ctx.call('musttail', ctx.signature.node, target, [
      ctx.state(),
      pos,
      ctx.endPos(),
      phi ? phi : ctx.TYPE_MATCH.v(0)
    ]);

    trampoline.push(call);
    trampoline.terminate('ret', [ ctx.fn.type.ret, call ]);
  }

  doBuild() {
    throw new Error('Not implemented');
  }
}
module.exports = Node;
