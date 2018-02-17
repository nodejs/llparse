'use strict';

const llparse = require('./');

const assert = require('assert');
const IR = require('llvm-ir');

const I32 = IR.i(32);
const TYPE_INPUT = IR.i(8).ptr();
const TYPE_OUTPUT = IR.i(8).ptr();
const TYPE_MATCH = I32;
const TYPE_INDEX = I32;
const TYPE_ERROR = I32;
const TYPE_REASON = IR.i(8).ptr();

const ARG_STATE = 's';
const ARG_POS = 'p';
const ARG_ENDPOS = 'endp';

class Compiler {
  constructor(prefix) {
    this.prefix = prefix;
    this.ir = new IR();
    this.trie = new llparse.Trie();

    this.state = this.ir.struct(`${this.prefix}_state`);

    this.signature = {
      node: this.ir.signature(TYPE_OUTPUT, [
        this.state.ptr(), TYPE_INPUT, TYPE_INPUT
      ]),
      callback: this.ir.signature(I32, [
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
  }

  build(root) {
    const rootFn = this.buildNode(root, null);

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
    }

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

    const call = IR._('call fastcc', [
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
    fn.visibility = 'internal fastcc';
    return fn;
  }

  buildNode(node, from) {
    if (node instanceof llparse.node.Skip) {
      if (!from)
        throw new Error('Skip node can\'t be a root state');

      return this.buildNode(from);
    }

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
    const info = { node, fn, otherwise: otherwise[0].next };

    const trie = this.trie.combine(node.cases);

    this.buildTrie(info, body, trie);

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
      this.buildRedirect(info, body, pos, this.buildNode(subNode, info.node));
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

    const branch = fn.body.branch('br', [ IR.i(1), cmp ]);

    // Return self when `pos === endpos`
    branch.right.name = 'prologue_end';
    this.buildSelfReturn(fn, branch.right);

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

    if (info.node.noAdvance) {
      pos.next = pos.current;
    } else {
      body.comment('next = pos + 1');
      pos.next = IR._('getelementptr', TYPE_INPUT.to,
        [ TYPE_INPUT, fn.arg(ARG_POS) ],
        [ I32, I32.v(1) ]);
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
    if (info.otherwise instanceof llparse.node.Skip)
      otherwisePos.next = pos.next;
    this.buildRedirect(info, body, otherwisePos,
      this.buildNode(info.otherwise, info.node));

    return body;
  }

  buildSwitch(body, type, what, values) {
    const cases = [];
    cases.push(IR.label('otherwise'));
    cases.push('[');
    values.forEach((value, i) => {
      const isLast = i === values.length - 1;
      cases.push(type, type.v(value));
      cases.push(',', IR.label(`case_${i}`));
    });
    cases.push(']');

    const blocks = body.terminate('switch', [ type, what ], cases);

    blocks[0].name = 'switch_otherwise';
    for (let i = 0; i< values.length; i++)
      blocks[i + 1].name = 'case_' + values[i];

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

  buildSequenceIteration(fn, body, seq, indexField, pos, index) {
    // Just a helper to reset `state.index`
    const reset = () => {
      return IR._('store', [ TYPE_INDEX, TYPE_INDEX.v(0) ],
            [ TYPE_INDEX.ptr(), indexField ]).void();
    };

    body.comment('current = *pos');
    const current = IR._('load', TYPE_INPUT.to, [ TYPE_INPUT, pos ]);
    body.push(current);

    body.comment('expected = seq[state.index]');
    const expectedPtr = IR._('getelementptr inbounds', seq.type.to,
        [ seq.type, seq ],
        [ I32, I32.v(0) ],
        [ I32, index ]);
    body.push(expectedPtr);
    const expected = IR._('load', TYPE_INPUT.to, [ TYPE_INPUT, expectedPtr ]);
    body.push(expected);

    body.comment('if (current == expected)');
    let cmp = IR._('icmp', [ 'eq', TYPE_INPUT.to, current ], expected);
    body.push(cmp);
    const { left: isMatch, right: isMismatch } =
      body.branch('br', [ IR.i(1), cmp ]);

    // Mismatch
    isMismatch.name = 'mismatch';
    isMismatch.comment('Sequence string does not match input');
    isMismatch.comment('state.index = 0');
    isMismatch.push(reset());

    // Character matches
    isMatch.name = 'match';
    isMatch.comment('Got a char match');
    isMatch.comment('next = pos + 1');
    const next = IR._('getelementptr', TYPE_INPUT.to,
      [ TYPE_INPUT, pos ],
      [ I32, I32.v(1) ]);
    isMatch.push(next);

    isMatch.comment('index1 = index + 1');
    const index1 = IR._('add', [ TYPE_INDEX, index ], TYPE_INDEX.v(1));
    isMatch.push(index1);

    isMatch.comment('if (index1 == seq.length)');
    cmp = IR._('icmp', [ 'eq', TYPE_INDEX, index1 ],
      TYPE_INDEX.v(seq.type.to.length));
    isMatch.push(cmp);
    const { left: isComplete, right: isIncomplete } =
      isMatch.branch('br', [ IR.i(1), cmp ]);

    isComplete.name = 'is_complete';
    isComplete.comment('state.index = 0');
    isComplete.push(reset());

    isIncomplete.name = 'is_incomplete';
    isIncomplete.comment('if (next != endpos)');
    cmp = IR._('icmp', [ 'ne', TYPE_INPUT, next ], fn.arg(ARG_ENDPOS));
    isIncomplete.push(cmp);
    const { left: moreData, right: noMoreData } =
      isIncomplete.branch('br', [ IR.i(1), cmp ]);

    moreData.name = 'more_data';

    noMoreData.name = 'no_more_data';
    noMoreData.comment('state.index = index1');
    noMoreData.push(IR._('store', [ TYPE_INDEX, index1 ],
      [ TYPE_INDEX.ptr(), indexField ]).void());

    return {
      index: index1,
      pos: { current: pos, next },
      complete: isComplete,
      otherwise: isMismatch,
      loop: moreData,
      pause: noMoreData
    };
  }

  // TODO(indutny): rework this into something readable
  buildSequence(info, body, trie) {
    assert(!info.node.noAdvance);

    const seq = this.ir.data(trie.select);

    // Load `state.index`
    body.comment('index = state.index');
    const indexField = this.field(info.fn, 'index');
    body.push(indexField);
    const index = IR._('load', TYPE_INDEX, [ TYPE_INDEX.ptr(), indexField ]);
    body.push(index);

    const loop = body.jump('br');
    loop.name = 'loop';

    // Loop start
    const posPhi = IR._('phi',
      [ TYPE_INPUT, '[', info.fn.arg(ARG_POS), ',', body.ref(), ']' ]);
    loop.push(posPhi);
    const indexPhi = IR._('phi',
      [ TYPE_INDEX, '[', index, ',', body.ref(), ']' ]);
    loop.push(indexPhi);

    const iteration = this.buildSequenceIteration(info.fn, loop, seq,
      indexField, posPhi, indexPhi);

    // It is complete!
    this.buildSubTrie(info, iteration.complete, iteration.pos, trie.children);

    // We have more data!
    iteration.loop.loop('br', loop);
    indexPhi.append([ '[', iteration.index, ',', iteration.loop.ref(), ']' ]);
    posPhi.append([ '[', iteration.pos.next, ',', iteration.loop.ref(), ']' ]);

    // Have to pause - return self
    this.buildSelfReturn(info.fn, iteration.pause);

    // Not equal
    // Reset `state.index` on mismatch
    return { pos: iteration.pos, body: iteration.otherwise };
  }

  buildNext(info, body, pos, trie) {
    // Set `state.match` if needed
    if (trie.value !== null) {
      const matchField = this.field(info.fn, 'match');
      body.comment('state.match = ' + trie.value);
      body.push(matchField);
      body.push(IR._('store', [ TYPE_MATCH, TYPE_MATCH.v(trie.value) ],
        [ TYPE_MATCH.ptr(), matchField ]).void());
    }

    this.buildRedirect(info, body, pos, this.buildNode(trie.next, info.node));
    return body;
  }

  buildRedirect(info, body, pos, target) {
    body.comment('redirect');
    const call = IR._('tail call fastcc', [
      TYPE_OUTPUT, target, '(',
      this.state.ptr(), info.fn.arg(ARG_STATE), ',',
      TYPE_INPUT, pos.next, ',',
      TYPE_INPUT, info.fn.arg(ARG_ENDPOS),
      ')'
    ]);
    body.push(call);
    body.terminate('ret', [ TYPE_OUTPUT, call ]);
    return body;
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
      [ I32, I32.v(0) ],
      [ I32, I32.v(this.state.lookup(name)) ]);
  }
}
module.exports = Compiler;
