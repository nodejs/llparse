'use strict';

const assert = require('assert');
const IR = require('llvm-ir');

const llparse = require('./');
const constants = llparse.constants;
const MatchSequence = llparse.MatchSequence;

const CCONV = constants.CCONV;

const BOOL = constants.BOOL;
const INT = constants.INT;
const TYPE_INPUT = constants.TYPE_INPUT;
const TYPE_OUTPUT = constants.TYPE_OUTPUT;
const TYPE_MATCH = constants.TYPE_MATCH;
const TYPE_INDEX = constants.TYPE_INDEX;
const TYPE_ERROR = constants.TYPE_ERROR;
const TYPE_REASON = constants.TYPE_REASON;

const ATTR_STATE = constants.ATTR_STATE;
const ATTR_POS = constants.ATTR_POS;
const ATTR_ENDPOS = constants.ATTR_ENDPOS;

const ARG_STATE = constants.ARG_STATE;
const ARG_POS = constants.ARG_POS;
const ARG_ENDPOS = constants.ARG_ENDPOS;

const SEQUENCE_COMPLETE = constants.SEQUENCE_COMPLETE;
const SEQUENCE_PAUSE = constants.SEQUENCE_PAUSE;
const SEQUENCE_MISMATCH = constants.SEQUENCE_MISMATCH;

class Compiler {
  constructor(prefix) {
    this.prefix = prefix;
    this.ir = new IR();

    this.state = this.ir.struct(`${this.prefix}_state`);

    this.signature = {
      node: this.ir.signature(TYPE_OUTPUT, [
        [ this.state.ptr(), ATTR_STATE ],
        [ TYPE_INPUT, ATTR_POS ],
        [ TYPE_INPUT, ATTR_ENDPOS ]
      ]),
      callback: this.ir.signature(INT, [
        this.state.ptr(), TYPE_INPUT, TYPE_INPUT
      ])
    };

    this.state.field(this.signature.node.ptr(), 'current');
    this.state.field(TYPE_ERROR, 'error');
    this.state.field(TYPE_REASON, 'reason');
    this.state.field(TYPE_INDEX, 'index');
    this.state.field(TYPE_MATCH, 'match');

    this.nodeMap = new Map();
    this.externalMap = new Map();
    this.counter = new Map();

    // redirect blocks by `fn` and `target`
    this.redirectCache = new Map();

    const matchSequence = new MatchSequence(this.prefix, this.ir, this.state);
    this.matchSequence = matchSequence.build();
  }

  build(root) {
    const rootFn = this.buildNode(root);

    this.buildInit(rootFn.ref());
    this.buildParse();

    return this.ir.build();
  }

  buildInit(fn) {
    const sig = IR.signature(IR.void(), [ this.state.ptr() ]);
    const init = this.ir.fn(sig, this.prefix + '_init', [ ARG_STATE ]);

    const fields = {
      current: this.field(init, 'current'),
      error: this.field(init, 'error'),
      reason: this.field(init, 'reason'),
      index: this.field(init, 'index'),
      match: this.field(init, 'match')
    };

    Object.keys(fields).forEach(key => init.body.push(fields[key]));

    const store = (field, type, value) => {
      init.body.push(IR._('store', [ type, value ],
        [ type.ptr(), field ]).void());
    };

    store(fields.current, fn.type, fn);
    store(fields.error, TYPE_ERROR, TYPE_ERROR.v(0));
    store(fields.reason, TYPE_REASON, TYPE_REASON.v(null));
    store(fields.index, TYPE_INDEX, TYPE_INDEX.v(0));
    store(fields.match, TYPE_MATCH, TYPE_MATCH.v(0));

    init.body.terminate('ret', IR.void());

    return init;
  }

  buildParse() {
    const sig = IR.signature(TYPE_ERROR,
      [ this.state.ptr(), TYPE_INPUT, TYPE_INPUT ]);
    const parse = this.ir.fn(sig, this.prefix + '_execute',
      [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);

    const body = parse.body;

    const nodeSig = this.signature.node;

    const currentPtr = this.field(parse, 'current');
    body.push(currentPtr);
    const current = IR._('load', nodeSig.ptr(),
      [ nodeSig.ptr().ptr(), currentPtr ]);
    body.push(current);

    const call = IR._(`call ${CCONV}`, [
      TYPE_OUTPUT, current, '(',
      this.state.ptr(), parse.arg(ARG_STATE), ',',
      TYPE_INPUT, parse.arg(ARG_POS), ',',
      TYPE_INPUT, parse.arg(ARG_ENDPOS),
      ')'
    ]);
    body.push(call);

    const errorPtr = this.field(parse, 'error');
    body.push(errorPtr);
    const error = IR._('load', TYPE_ERROR, [ TYPE_ERROR.ptr(), errorPtr ]);
    body.push(error);

    const bitcast = IR._('bitcast', [ TYPE_OUTPUT, call, 'to', nodeSig.ptr() ]);
    body.push(bitcast);
    body.push(IR._('store', [ nodeSig.ptr(), bitcast ],
      [ nodeSig.ptr().ptr(), currentPtr ]).void());

    body.terminate('ret', [ TYPE_ERROR, error ]);
  }

  createFn(node) {
    let index;
    if (this.counter.has(node.name))
      index = this.counter.get(node.name);
    else
      index = 0;
    this.counter.set(node.name, index + 1);

    const name = `${this.prefix}__${node.name}` +
      `${index === 0 ? '' : '_' + index}`;

    const fn = this.ir.fn(this.signature.node, name,
      [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);
    fn.visibility = 'internal';
    fn.cconv = CCONV;

    // TODO(indutny): reassess `minsize`. Looks like it gives best performance
    // results right now, though.
    fn.attributes = 'nounwind minsize';

    // Errors are assumed to be rarely called
    if (node instanceof llparse.node.Error)
      fn.attributes += ' cold writeonly';
    return fn;
  }

  buildNode(node) {
    if (this.nodeMap.has(node))
      return this.nodeMap.get(node);

    const fn = this.createFn(node);
    this.nodeMap.set(node, fn);

    let body = this.buildPrologue(node, fn);

    if (node instanceof llparse.node.Error) {
      const info = { node, fn, otherwise: null };
      this.buildError(info, body);
      return fn;
    }

    const otherwise =
      node.cases.filter(c => c instanceof llparse.case.Otherwise);
    assert.strictEqual(otherwise.length, 1,
      `Node "${node.name}" must have only 1 \`.otherwise()\``);
    const info = {
      node,
      fn,
      otherwise: otherwise[0].next,
      skip: otherwise[0].skip
    };

    const trie = new llparse.Trie(node.name);
    const combined = trie.combine(node.cases);

    this.buildTrie(info, body, combined);

    return fn;
  }

  buildInvoke(info, body, pos, callback) {
    let external;
    if (this.externalMap.has(callback)) {
      external = this.externalMap.get(callback);
    } else {
      external = this.ir.declare(this.signature.callback, callback);
      external.attributes = 'alwaysinline';

      this.externalMap.set(callback, external);
    }

    const returnType = this.signature.callback.ret;

    const call = IR._('call', [
      returnType, external, '(',
      this.state.ptr(), info.fn.arg(ARG_STATE), ',',
      TYPE_INPUT, info.fn.arg(ARG_POS), ',',
      TYPE_INPUT, info.fn.arg(ARG_ENDPOS),
      ')'
    ]);
    body.push(call);

    const keys = Object.keys(info.node.map).map(key => key | 0);
    const s = this.buildSwitch(body, returnType, call, keys);

    s.cases.forEach((body, i) => {
      const subNode = info.node.map[keys[i]];
      this.buildRedirect(info, body, pos, this.buildNode(subNode));
    });

    return s.otherwise;
  }

  buildSubTrie(info, body, pos, trie) {
    if (trie.type === 'next')
      return this.buildNext(info, body, pos, trie);

    const subFn = this.createFn(info.node);
    const subInfo = { fn: subFn, node: info.node, otherwise: info.otherwise };

    const subBody = this.buildPrologue(info.node, subFn);
    this.buildTrie(subInfo, subBody, trie);

    this.buildRedirect(info, body, pos, subFn);
    return subFn;
  }

  buildPrologue(node, fn) {
    if (node.noAdvance)
      return fn.body;

    // Check that we have enough chars to do the read
    fn.body.comment('--- Prologue ---');
    fn.body.comment('if (pos != endpos)');
    const cmp = IR._('icmp', [ 'ne', TYPE_INPUT, fn.arg(ARG_POS) ],
      fn.arg(ARG_ENDPOS));
    fn.body.push(cmp);

    const branch = fn.body.branch('br', [ BOOL, cmp ]);

    // Return self when `pos === endpos`
    branch.right.name = 'prologue_end';
    this.buildSelfReturn(fn, branch.right, true);

    branch.left.name = 'prologue_normal';
    return branch.left;
  }

  buildSelfReturn(fn, body) {
    const bitcast = IR._('bitcast', [ fn.type.ptr(), fn, 'to', TYPE_OUTPUT ]);
    body.push(bitcast);
    body.terminate('ret', [ TYPE_OUTPUT, bitcast ]);
  }

  buildTrie(info, body, trie) {
    const fn = info.fn;

    // Increment `pos` if not invoking external callback
    let pos = { current: fn.arg(ARG_POS), next: null };

    // NOTE: `sequence` has loop inside it - so it isn't going to use
    // `pos.next` anyway (as a matter of fact it doesn't get `pos` as an
    // argument at all)
    if (info.node.noAdvance || trie && trie.type === 'sequence') {
      pos.next = pos.current;
    } else {
      body.comment('next = pos + 1');
      pos.next = IR._('getelementptr', TYPE_INPUT.to,
        [ TYPE_INPUT, fn.arg(ARG_POS) ],
        [ INT, INT.v(1) ]);
      body.push(pos.next);
    }

    if (info.node instanceof llparse.node.Invoke)
      body = this.buildInvoke(info, body, pos, info.node.callback);

    // Traverse the `trie`
    if (trie === null) {
      // no-op
    } else if (trie.type === 'single') {
      body = this.buildSingle(info, body, pos, trie.children);
    } else if (trie.type === 'sequence') {
      // NOTE: do not send `pos` here! (see comment above)
      const seq = this.buildSequence(info, body, trie);

      // NOTE: `sequence` implementation loops if there's enough data
      body = seq.body;
      pos = seq.pos;
    } else {
      // NOTE: `next` type must be parsed in `buildSubTrie`
      throw new Error('Unexpected trie node type: ' + trie.type);
    }

    // Do not increment `pos` when falling through, unless we're skipping
    const otherwisePos = { current: pos.current, next: pos.current };
    if (info.skip)
      otherwisePos.next = pos.next;
    this.buildRedirect(info, body, otherwisePos,
      this.buildNode(info.otherwise));

    return body;
  }

  buildSwitch(body, type, what, values) {
    const cases = [];
    cases.push(IR.label('otherwise'));
    cases.push('[');
    values.forEach((value, i) => {
      cases.push(type, type.v(value));
      cases.push(',', IR.label(`case_${i}`));
    });
    cases.push(']');

    const blocks = body.terminate('switch', [ type, what ], cases);

    blocks[0].name = 'switch_otherwise';
    for (let i = 0; i < values.length; i++) {
      const v = values[i] < 0 ? 'm' + (-values[i]) : values[i];
      blocks[i + 1].name = 'case_' + v;
    }

    return {
      otherwise: blocks[0],
      cases: blocks.slice(1)
    };
  }

  buildSingle(info, body, pos, children) {
    // Load the character
    const current =
      IR._('load', TYPE_INPUT.to, [ TYPE_INPUT, info.fn.arg(ARG_POS) ]);
    body.push(current);

    const keys = children.map(child => child.key);
    const s = this.buildSwitch(body, TYPE_INPUT.to, current, keys);

    const otherwise = s.otherwise;
    const cases = s.cases;

    cases.forEach((target, i) => {
      this.buildSubTrie(info, target, pos, children[i].child);
    });

    return otherwise;
  }

  buildSequence(info, body, trie) {
    assert(!info.node.noAdvance);

    const seq = this.ir.data(trie.select);

    const cast = IR._('getelementptr inbounds', seq.type.to,
      [ seq.type, seq ],
      [ INT, INT.v(0) ],
      [ INT, INT.v(0) ]);
    body.push(cast);

    const returnType = this.matchSequence.type.ret;

    const call = IR._(`call ${CCONV}`, [
      returnType, this.matchSequence, '(',
      this.state.ptr(), info.fn.arg(ARG_STATE), ',',
      TYPE_INPUT, info.fn.arg(ARG_POS), ',',
      TYPE_INPUT, info.fn.arg(ARG_ENDPOS), ',',
      TYPE_INPUT, cast, ',',
      INT, INT.v(seq.type.to.length),
      ')'
    ]);
    body.push(call);

    const status = IR._('extractvalue', [ returnType, call ],
      INT.v(returnType.lookup('status')));
    body.push(status);

    const current = IR._('extractvalue', [ returnType, call ],
      INT.v(returnType.lookup('current')));
    body.push(current);

    // This is lame, but it is easier to do it this way
    // (Optimizer will remove it, if it isn't needed)
    body.comment('next = pos + 1');
    const next = IR._('getelementptr', TYPE_INPUT.to,
      [ TYPE_INPUT, current ],
      [ INT, INT.v(1) ]);
    body.push(next);

    const pos = { current, next };

    const s = this.buildSwitch(body, INT, status, [
      SEQUENCE_COMPLETE,
      SEQUENCE_PAUSE,
      SEQUENCE_MISMATCH
    ]);

    // No other values are allowed
    s.otherwise.terminate('unreachable');

    const complete = s.cases[0];
    const pause = s.cases[1];
    const mismatch = s.cases[2];

    this.buildSubTrie(info, complete, pos, trie.children);
    this.buildSelfReturn(info.fn, pause);

    // Not equal
    // Reset `state.index` on mismatch
    return { pos, body: mismatch };
  }

  buildNext(info, body, pos, trie) {
    return this.buildRedirect(info, body, pos, this.buildNode(trie.next),
      trie.value);
  }

  buildRedirect(info, body, pos, target, value = null) {
    const fn = info.fn;

    if (this.redirectCache.has(fn) &&
        this.redirectCache.get(fn).has(target)) {
      const cached = this.redirectCache.get(fn).get(target);

      if (cached.phi) {
        assert(value,  '`.match()` and `.select()` with the same target');
        cached.phi.append([ '[', TYPE_MATCH.v(value), ',', body.ref(), ']' ]);
      } else {
        assert(!value,  '`.match()` and `.select()` with the same target');
      }

      body.terminate('br', cached.target);
      return;
    }

    // Split, so that others could join us from code block above
    const redirect = body.jump('br');
    let phi = null;

    // Set `state.match` if needed
    if (value !== null) {
      redirect.comment('state.match = phi');
      phi = IR._('phi',
        [ TYPE_MATCH, '[', TYPE_MATCH.v(value), ',', body.ref(), ']' ]);
      redirect.push(phi);

      const matchField = this.field(fn, 'match');
      redirect.push(matchField);
      redirect.push(IR._('store', [ TYPE_MATCH, phi ],
        [ TYPE_MATCH.ptr(), matchField ]).void());
    }

    if (!this.redirectCache.has(fn))
      this.redirectCache.set(fn, new Map());
    this.redirectCache.get(fn).set(target, {
      phi,
      target: redirect
    });

    // TODO(indutny): looks like `musttail` gives worse performance when calling
    // Invoke nodes (possibly others too).
    const call = IR._(`musttail call ${CCONV}`, [
      TYPE_OUTPUT, target, '(',
      this.state.ptr(), fn.arg(ARG_STATE), ',',
      TYPE_INPUT, pos.next, ',',
      TYPE_INPUT, fn.arg(ARG_ENDPOS),
      ')'
    ]);
    redirect.push(call);
    redirect.terminate('ret', [ TYPE_OUTPUT, call ]);
  }

  buildError(info, body) {
    const code = info.node.code;
    const reason = this.ir.cstr(info.node.reason);

    const codeField = this.field(info.fn, 'error');
    body.push(codeField);

    const reasonField = this.field(info.fn, 'reason');
    body.push(reasonField);

    const castReason = IR._('bitcast', [
      reason.type, reason, 'to', TYPE_REASON
    ]);
    body.push(castReason);

    body.push(IR._('store', [ TYPE_ERROR, TYPE_ERROR.v(code) ],
      [ TYPE_ERROR.ptr(), codeField ]).void());
    body.push(IR._('store', [ TYPE_REASON, castReason ],
      [ TYPE_REASON.ptr(), reasonField ]).void());

    return body.terminate('ret', [ TYPE_OUTPUT, TYPE_OUTPUT.v(null) ]);
  }

  field(fn, name) {
    const stateArg = fn.arg(ARG_STATE);

    return IR._('getelementptr', this.state,
      [ stateArg.type, stateArg ],
      [ INT, INT.v(0) ],
      [ INT, INT.v(this.state.lookup(name)) ]);
  }
}
module.exports = Compiler;
