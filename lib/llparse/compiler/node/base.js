'use strict';

const assert = require('assert');

const node = require('./');
const llparse = require('../../');
const constants = llparse.constants;

class NodeContext {
  constructor(ctx, name, fn, nodes) {
    this.compilation = ctx;
    this.name = name;
    this.fn = fn;
    this.nodes = nodes;

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
    this.TYPE_INDEX = constants.TYPE_INDEX;
    this.TYPE_INTPTR = constants.TYPE_INTPTR;

    this.INVARIANT_GROUP = ctx.INVARIANT_GROUP;

    this.hasPause = false;
  }

  debug(body, message) {
    this.compilation.debug(this.fn, body, `${this.name}: ${message}`);
  }

  // Just proxy
  stateField(body, name) {
    return this.compilation.stateField(this.fn, body, name);
  }

  cstring(...args) { return this.compilation.cstring(...args); }
  blob(...args) { return this.compilation.blob(...args); }
  addGlobalConst(...args) { return this.compilation.addGlobalConst(...args); }
  truncate(...args) { return this.compilation.truncate(...args); }
  call(...args) { return this.compilation.call(...args); }
  buildSwitch(...args) { return this.compilation.buildSwitch(...args); }
  branch(...args) { return this.compilation.branch(...args); }
}

class Node {
  constructor(type, id) {
    this.type = type;
    this.name = id.name;
    this.sourceName = id.sourceName;
    this.otherwise = null;
    this.skip = false;
    this.transform = null;
    this.noPrologueCheck = false;

    this.fn = null;
    this.phis = new Map();
  }

  setOtherwise(otherwise, skip) {
    this.otherwise = otherwise;
    this.skip = skip;
  }

  getChildren() {
    return [ { node: this.otherwise, noAdvance: !this.skip, key: null } ];
  }

  getResumptionTargets() {
    if (this.hasPause)
      return [ this ];
    else
      return [];
  }

  // Building

  build(compilation, nodes) {
    if (nodes.has(this))
      return nodes.get(this);

    const fn = compilation.fn(compilation.signature.node, this.name);
    const ctx = new NodeContext(compilation, this.name, fn, nodes);

    // Errors are assumed to be rarely called
    // TODO(indutny): move this to node.Error somehow?
    if (this instanceof node.Error) {
      fn.attrs.add([ 'norecurse', 'cold', 'writeonly', 'noinline' ]);
    }

    nodes.set(this, fn);

    let body = fn.body;
    ctx.debug(body, 'enter');
    body = this.prologue(ctx, body);

    ctx.pos.next = body.getelementptr(ctx.pos.current, ctx.INT.val(1));

    this.doBuild(ctx, body);

    return fn;
  }

  prologue(ctx, body) {
    if (this.noPrologueCheck)
      return body;

    const pos = ctx.pos.current;
    const endPos = ctx.endPos;

    // Check that we have enough chars to do the read
    const cmp = body.icmp('ne', pos, endPos);

    const branch = ctx.branch(body, cmp);

    // Return self when `pos === endpos`
    branch.right.name = 'no_data';
    this.pause(ctx, branch.right);

    branch.left.name = 'has_data';
    return branch.left;
  }

  pause(ctx, body) {
    const fn = ctx.fn;
    const bitcast = body.cast('bitcast', fn, fn.ty.toSignature().returnType);
    body.ret(bitcast);

    // To be used in `compiler.js`
    this.hasPause = true;
  }

  buildNode(ctx, node) {
    return node.build(ctx.compilation, ctx.nodes);
  }

  tailTo(ctx, body, pos, node, value = null) {
    const target = this.buildNode(ctx, node);

    const isCacheable = ctx.pos.next === pos;

    if (isCacheable && this.phis.has(target)) {
      const cached = this.phis.get(target);

      if (cached.phi) {
        assert(value,  '`.match()` and `.select()` with the same target');
        cached.phi.addEdge({
          fromBlock: body,
          value: ctx.TYPE_MATCH.val(value)
        });
      } else {
        assert(!value,  '`.match()` and `.select()` with the same target');
      }

      body.jmp(cached.trampoline);
      return target;
    }

    // Split, so that others could join us from code block above
    const trampoline = body.parent.createBlock(body.name + '.trampoline');
    body.jmp(trampoline);
    let phi = null;

    // Compute `match` if needed
    if (value !== null) {
      phi = trampoline.phi({
        fromBlock: body,
        value: ctx.TYPE_MATCH.val(value)
      });
    }

    if (isCacheable)
      this.phis.set(target, { phi, trampoline });

    const call = trampoline.call(target, [
      ctx.state,
      pos,
      ctx.endPos,
      phi ? phi : ctx.TYPE_MATCH.undef()
    ], 'musttail');

    trampoline.ret(call);

    return target;
  }

  doBuild() {
    throw new Error('Not implemented');
  }

  doOtherwise(ctx, body, pos) {
    if (!pos)
      pos = ctx.pos;

    // `.skipTo()` advances by one byte
    // `.otherwise()` redirects using the same byte
    const next = this.skip ? pos.next : pos.current;

    assert(this.otherwise);
    return this.tailTo(ctx, body, next, this.otherwise);
  }
}
module.exports = Node;
