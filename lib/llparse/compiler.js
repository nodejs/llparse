'use strict';

const assert = require('assert');
const IR = require('llvm-ir');

const llparse = require('./');
const constants = llparse.constants;
const MatchSequence = llparse.MatchSequence;

const kBody = llparse.symbols.kBody;
const kCases = llparse.symbols.kCases;
const kNoAdvance = llparse.symbols.kNoAdvance;
const kOtherwise = llparse.symbols.kOtherwise;
const kSignature = llparse.symbols.kSignature;
const kType = llparse.symbols.kType;

const CCONV = constants.CCONV;

const BOOL = constants.BOOL;
const INT = constants.INT;
const TYPE_INPUT = constants.TYPE_INPUT;
const TYPE_OUTPUT = constants.TYPE_OUTPUT;
const TYPE_MATCH = constants.TYPE_MATCH;
const TYPE_INDEX = constants.TYPE_INDEX;
const TYPE_ERROR = constants.TYPE_ERROR;
const TYPE_REASON = constants.TYPE_REASON;
const TYPE_DATA = constants.TYPE_DATA;

const ATTR_STATE = constants.ATTR_STATE;
const ATTR_POS = constants.ATTR_POS;
const ATTR_ENDPOS = constants.ATTR_ENDPOS;

const ARG_STATE = constants.ARG_STATE;
const ARG_POS = constants.ARG_POS;
const ARG_ENDPOS = constants.ARG_ENDPOS;
const ARG_MATCH = constants.ARG_MATCH;
const ARG_UNUSED = constants.ARG_UNUSED;

const SEQUENCE_COMPLETE = constants.SEQUENCE_COMPLETE;
const SEQUENCE_PAUSE = constants.SEQUENCE_PAUSE;
const SEQUENCE_MISMATCH = constants.SEQUENCE_MISMATCH;

class Compiler {
  constructor(prefix, properties) {
    this.prefix = prefix;
    this.ir = new IR();

    this.state = this.ir.struct(`${this.prefix}_state`);

    this.signature = {
      node: this.ir.signature(TYPE_OUTPUT, [
        [ this.state.ptr(), ATTR_STATE ],
        [ TYPE_INPUT, ATTR_POS ],
        [ TYPE_INPUT, ATTR_ENDPOS ],
        TYPE_MATCH
      ]),
      callback: {
        match: this.ir.signature(INT, [
          this.state.ptr(), TYPE_INPUT, TYPE_INPUT
        ]),
        value: this.ir.signature(INT, [
          this.state.ptr(), TYPE_INPUT, TYPE_INPUT, TYPE_MATCH
        ])
      }
    };

    this.state.field(this.signature.node.ptr(), 'current');
    this.state.field(TYPE_ERROR, 'error');
    this.state.field(TYPE_REASON, 'reason');
    this.state.field(TYPE_INDEX, 'index');
    this.state.field(TYPE_DATA, 'data');

    properties.forEach((prop) => {
      this.state.field(prop.type(this.ir, this.state), prop.name);
    });

    this.nodeMap = new Map();
    this.codeMap = new Map();
    this.counter = new Map();

    // redirect blocks by `fn` and `target`
    this.redirectCache = new Map();

    const matchSequence = new MatchSequence(this.prefix, this.ir, this.state);
    this.matchSequence = matchSequence.build();
  }

  build(root) {
    // Check that we don't start with a `value` Invoke
    this.checkSignatureType(root, null);

    const rootFn = this.buildNode(root).fn;

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
      index: this.field(init, 'index')
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

    init.body.terminate('ret', IR.void());

    return init;
  }

  buildParse() {
    // TODO(indutny): change signature to (state*, start*, len)?
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
      TYPE_INPUT, parse.arg(ARG_ENDPOS), ',',
      TYPE_MATCH, TYPE_MATCH.v(0),
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

    let fn;
    if (node[kSignature] === 'match') {
      fn = this.ir.fn(this.signature.node, name,
        [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_UNUSED ]);
    } else {
      assert.strictEqual(node[kSignature], 'value');
      fn = this.ir.fn(this.signature.node, name,
        [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_MATCH ]);
    }
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
    this.nodeMap.set(node, { fn, node });

    let body = this.buildPrologue(node, fn);

    if (node instanceof llparse.node.Error) {
      const info = { node, fn, otherwise: null };
      this.buildError(info, body);
      return { fn, node };
    }

    const otherwise = node[kOtherwise];
    assert.notStrictEqual(otherwise, null,
      `Node "${node.name}" must have \`.otherwise()\`/\`.skipTo()\``);
    const info = {
      node,
      fn,
      otherwise: otherwise.next,
      skip: otherwise.skip
    };

    const trie = new llparse.Trie(node.name);
    const combined = trie.combine(node[kCases]);

    this.buildTrie(info, body, combined);

    return { fn, node };
  }

  buildCode(node, code) {
    assert.strictEqual(node[kSignature], code[kType]);

    const signature = code[kType] === 'match' ?
      this.signature.callback.match :
      this.signature.callback.value;

    const name = code.name;
    if (this.codeMap.has(name)) {
      const cached = this.codeMap.get(name);
      assert.strictEqual(cached.type, signature,
        `Conflicting code entries for "${name}"`);
      return cached;
    }

    let fn;
    if (code[kBody] === null) {
      const external = this.ir.declare(signature, name);
      external.attributes = 'alwaysinline';

      fn = external;
    } else {
      fn = this.buildCodeWithBody(code, signature);
    }

    this.codeMap.set(name, fn);
    return fn;
  }

  buildCodeWithBody(code, signature) {
    const args = [
      constants.ARG_STATE,
      constants.ARG_POS,
      constants.ARG_ENDPOS
    ];

    if (code[kType] === 'value')
      args.push(constants.ARG_MATCH);

    const fn = this.ir.fn(signature, code.name, args);

    fn.visibility = 'internal';
    fn.cconv = CCONV;
    fn.attributes = 'nounwind';

    const context = new llparse.Context(code, fn);

    fn.body.comment('custom user code');
    code[kBody].call(fn.body, this.ir, context);

    return fn;
  }

  buildInvoke(info, body, pos) {
    const code = this.buildCode(info.node, info.node.code);

    const args = [
      code.type.ret, code, '(',
      this.state.ptr(), info.fn.arg(ARG_STATE), ',',
      TYPE_INPUT, info.fn.arg(ARG_POS), ',',
      TYPE_INPUT, info.fn.arg(ARG_ENDPOS)
    ];

    if (info.node[kSignature] === 'value')
      args.push(',', TYPE_MATCH, info.fn.arg(ARG_MATCH));
    else
      assert.strictEqual(info.node[kSignature], 'match');

    args.push(')');

    const cconv = code.cconv ? ' ' + code.cconv : '';

    const call = IR._('call' + cconv, args);
    body.push(call);

    const keys = Object.keys(info.node.map).map(key => key | 0);
    const s = this.buildSwitch(body, code.type.ret, call, keys);

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

    this.buildRedirect(info, body, pos, { fn: subFn, node: info.node });
    return subFn;
  }

  buildPrologue(node, fn) {
    if (node[kNoAdvance])
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
    this.buildSelfReturn({ fn, node }, branch.right, true);

    branch.left.name = 'prologue_normal';
    return branch.left;
  }

  buildSelfReturn(info, body) {
    assert.strictEqual(info.node[kSignature], 'match',
      'non-match nodes can\'t have self return');

    const fn = info.fn;
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
    if (info.node[kNoAdvance] || trie && trie.type === 'sequence') {
      pos.next = pos.current;
    } else {
      body.comment('next = pos + 1');
      pos.next = IR._('getelementptr', TYPE_INPUT.to,
        [ TYPE_INPUT, fn.arg(ARG_POS) ],
        [ INT, INT.v(1) ]);
      body.push(pos.next);
    }

    if (info.node instanceof llparse.node.Invoke)
      body = this.buildInvoke(info, body, pos);

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
    assert(!info.node[kNoAdvance]);

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
    this.buildSelfReturn(info, pause);

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

    this.checkSignatureType(target.node, value);

    if (this.redirectCache.has(fn) &&
        this.redirectCache.get(fn).has(target.fn)) {
      const cached = this.redirectCache.get(fn).get(target.fn);

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
    redirect.name = body.name + '_redirect';
    let phi = null;

    // Compute `match` if needed
    if (value !== null) {
      redirect.comment('Select `match`');
      phi = IR._('phi',
        [ TYPE_MATCH, '[', TYPE_MATCH.v(value), ',', body.ref(), ']' ]);
      redirect.push(phi);
    }

    if (!this.redirectCache.has(fn))
      this.redirectCache.set(fn, new Map());
    this.redirectCache.get(fn).set(target.fn, {
      phi,
      target: redirect
    });

    const args = [
      TYPE_OUTPUT, target.fn, '(',
      this.state.ptr(), fn.arg(ARG_STATE), ',',
      TYPE_INPUT, pos.next, ',',
      TYPE_INPUT, fn.arg(ARG_ENDPOS), ',',
      TYPE_MATCH, phi ? phi : TYPE_MATCH.v(0),
      ')'
    ];

    // TODO(indutny): looks like `musttail` gives worse performance when calling
    // Invoke nodes (possibly others too).
    const call = IR._(`musttail call ${CCONV}`, args);
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

  // Helpers

  field(fn, name) {
    const stateArg = fn.arg(ARG_STATE);

    return IR._('getelementptr', this.state,
      [ stateArg.type, stateArg ],
      [ INT, INT.v(0) ],
      [ INT, INT.v(this.state.lookup(name)) ]);
  }

  checkSignatureType(node, value) {
    assert.strictEqual(node[kSignature], value === null ? 'match' : 'value');
  }
}
module.exports = Compiler;
