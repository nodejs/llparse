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
    this.counter = new Map();
  }

  build(root) {
    // TODO(indutny): init function
    // TODO(indutny): parse function

    this.buildNode(root);

    return this.ir.build();
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
    const info = { node, fn, otherwise: otherwise[0].next };

    const trie = this.trie.combine(node.cases);

    this.buildTrie(info, body, trie);

    return fn;
  }

  buildInvoke(info, body, pos, callback) {
    const external = this.ir.declare(this.signature.callback, callback);
    external.attributes = 'alwaysinline';

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
    const cmp = IR._('icmp', [ 'ne', TYPE_INPUT, fn.arg(ARG_POS) ],
      fn.arg(ARG_ENDPOS));
    fn.body.push(cmp);

    const branch = fn.body.branch('br', [ IR.i(1), cmp ]);

    // Return self when `pos === endpos`
    this.buildSelfReturn(fn, branch.right);

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

    this.buildRedirect(info, body, pos, this.buildNode(info.otherwise));

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
    const seq = this.ir.data(trie.select);

    // Load `state.index`
    const indexField = this.field(info.fn, 'index');
    body.push(indexField);
    const index = IR._('load', TYPE_INDEX, [ TYPE_INDEX.ptr(), indexField ]);
    body.push(index);

    const loop = body.jump('br');

    // Loop start
    const posPhi = IR._('phi',
      [ TYPE_INPUT, '[', info.fn.arg(ARG_POS), ',', body.ref(), ']' ]);
    loop.push(posPhi);
    const indexPhi = IR._('phi',
      [ TYPE_INDEX, '[', index, ',', body.ref(), ']' ]);
    loop.push(indexPhi);

    const current = IR._('load', TYPE_INPUT.to, [ TYPE_INPUT, posPhi ]);
    loop.push(current);

    // Get `expected = seq[state.index]`
    const expectedPtr = IR._('getelementptr inbounds', seq.type.to,
        [ seq.type, seq ],
        [ I32, I32.v(0) ],
        [ I32, indexPhi ]);
    loop.push(expectedPtr);
    const expected = IR._('load', TYPE_INPUT.to, [ TYPE_INPUT, expectedPtr ]);
    loop.push(expected);

    // Check `current === expected`
    const cmp = IR._('icmp', [ 'eq', TYPE_INPUT.to, current ], expected);
    loop.push(cmp);
    const branch = loop.branch('br', [ IR.i(1), cmp ]);

    const reset = () => {
      return IR._('store', [ TYPE_INDEX, TYPE_INDEX.v(0) ],
            [ TYPE_INDEX.ptr(), indexField ]).void();
    };

    // Equal!
    body = branch.left;

    const next = IR._('getelementptr', TYPE_INPUT.to,
      [ TYPE_INPUT, posPhi ],
      [ I32, I32.v(1) ]);
    body.push(next);

    // Increment `state.index`
    const index1 = IR._('add', [ TYPE_INDEX, indexPhi ], TYPE_INDEX.v(1));
    body.push(index1);

    // Check `state.index === seq.length`
    const complete = IR._('icmp', [ 'eq', TYPE_INDEX, index1 ],
      TYPE_INDEX.v(trie.select.length));
    body.push(complete);
    const completeBranch = body.branch('br', [ IR.i(1), complete ]);

    // It is complete!
    completeBranch.left.push(reset());
    const pos = { current, next };
    this.buildSubTrie(info, completeBranch.left, pos, trie.children);

    // Not yet complete
    body = completeBranch.right;

    // Loop if there is more data
    const hasMore = IR._('icmp', [ 'ne', TYPE_INPUT, posPhi ],
      info.fn.arg(ARG_ENDPOS));
    body.push(hasMore);
    const hasMoreBranch = body.branch('br', [ IR.i(1), hasMore ]);

    // We have more data!
    body = hasMoreBranch.left;

    body.loop('br', loop);
    indexPhi.append([ '[', index1, ',', body.ref(), ']' ]);
    posPhi.append([ '[', next, ',', body.ref(), ']' ]);

    // No more data
    body = hasMoreBranch.right;
    body.push(IR._('store', [ TYPE_INDEX, index1 ],
      [ TYPE_INDEX.ptr(), indexField ]).void());

    this.buildSelfReturn(info.fn, body);

    // Not equal
    // Reset `state.index` on mismatch
    branch.right.push(reset());
    return { pos, body: branch.right };
  }

  buildNext(info, body, pos, trie) {
    // Set `state.match` if needed
    if (trie.value !== null) {
      const matchField = this.field(info.fn, 'match');
      body.push(matchField);
      body.push(IR._('store', [ TYPE_MATCH, TYPE_MATCH.v(trie.value) ],
        [ TYPE_MATCH.ptr(), matchField ]).void());
    }

    this.buildRedirect(info, body, pos, this.buildNode(trie.next));
    return body;
  }

  buildRedirect(info, body, pos, target) {
    const call = IR._('tail call', [
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
