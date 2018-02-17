'use strict';

const llparse = require('./');

const assert = require('assert');
const IR = require('llvm-ir');

const I32 = IR.i(32);
const TYPE_INPUT = IR.i(8).ptr();
const TYPE_OUTPUT = IR.i(8).ptr();
const TYPE_MATCH = I32;
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

    this.sig = this.ir.signature(TYPE_OUTPUT, [
      this.state.ptr(), TYPE_INPUT, TYPE_INPUT
    ]);

    this.state.field(TYPE_ERROR, 'error');
    this.state.field(TYPE_REASON, 'reason');
    this.state.field(TYPE_MATCH, 'match');
    this.state.field(TYPE_OUTPUT, 'current');

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

    const fn = this.ir.fn(this.sig, name, [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);
    fn.visibility = 'internal fastcc';
    return fn;
  }

  buildNode(node) {
    if (this.nodeMap.has(node))
      return this.nodeMap.get(node);

    const fn = this.createFn(node);
    this.nodeMap.set(node, fn);

    if (node instanceof llparse.node.Error) {
      const info = { node, fn, otherwise: null };
      this.buildError(info, fn.body);
      return fn;
    }

    const otherwise =
      node.cases.filter(c => c instanceof llparse.case.Otherwise);
    assert.strictEqual(otherwise.length, 1,
      `Node "${node.name}" must have only 1 \`.otherwise()\``);

    const trie = this.trie.combine(node.cases);

    const info = { node, fn, otherwise: otherwise[0].next };
    this.buildTrie(info, fn.body, trie);

    return fn;
  }

  buildSubTrie(info, body, inc, trie) {
    const subFn = this.createFn(info.node);
    const subInfo = { fn: subFn, node: info.node, otherwise: info.otherwise };
    this.buildTrie(subInfo, subFn.body, trie);

    this.buildRedirect(info, body, inc, subFn);
    return subFn;
  }

  buildTrie(info, body, trie) {
    const fn = info.fn;

    // Check that we have enough to do the read
    const cmp = IR._('icmp', [ 'ne', TYPE_INPUT, fn.arg(ARG_POS) ],
      fn.arg(ARG_ENDPOS));
    body.push(cmp);

    const branch = body.branch('br', [ IR.i(1), cmp ]);

    // Return self when `pos === endpos`
    const bitcast = IR._('bitcast', [ fn.type.ptr(), fn, 'to', TYPE_OUTPUT ]);
    branch.right.push(bitcast);
    branch.right.terminate('ret', [ TYPE_OUTPUT, bitcast ]);

    // Load the character
    body = branch.left;
    const cur = IR._('load', TYPE_INPUT.to, [ TYPE_INPUT, fn.arg(ARG_POS) ]);
    body.push(cur);

    // Increment `pos`
    const inc = IR._('getelementptr', TYPE_INPUT.to,
      [ TYPE_INPUT, fn.arg(ARG_POS) ],
      [ I32, I32.v(1) ]);
    body.push(inc);

    // Traverse the `trie`
    if (trie === null) {
      // no-op
    } else if (trie.type === 'single') {
      body = this.buildSingle(info, body, cur, inc, trie.children);
    } else if (trie.type === 'sequence') {
      body = this.buildSequence(info, body, cur, inc, trie);
    } else if (trie.type === 'next') {
      // `next` is a final trie node
      return this.buildNext(info, body, inc, trie);
    } else {
      throw new Error('Unknown trie node type: ' + trie.type);
    }

    this.buildRedirect(info, body, inc, this.buildNode(info.otherwise));

    return body;
  }

  buildSingle(info, body, cur, pos, children) {
    const cases = [];
    cases.push(IR.label('otherwise'));
    cases.push('[');
    children.forEach((child, i) => {
      const isLast = i === children.length - 1;
      cases.push(TYPE_INPUT.to, TYPE_INPUT.to.v(child.key));
      cases.push(',', IR.label(`case_${i}`));
    });
    cases.push(']');

    const blocks = body.terminate('switch', [ TYPE_INPUT.to, cur ], cases);

    const otherwise = blocks[0];
    const targets = blocks.slice(1);

    targets.forEach((target, i) => {
      this.buildSubTrie(info, target, pos, children[i].child);
    });

    return otherwise;
  }

  buildSequence(info, body, cur, pos, trie) {
    console.log(trie);
    return body;
  }

  buildNext(info, body, pos, trie) {
    if (trie.value !== null) {
      const stateArg = info.fn.arg(ARG_STATE);

      const matchField = IR._('getelementptr', this.state,
        [ stateArg.type, stateArg ],
        [ I32, I32.v(0) ],
        [ I32, I32.v(this.state.lookup('match')) ]);
      body.push(matchField);
      body.push(IR._('store', [ TYPE_MATCH, TYPE_MATCH.v(trie.value) ],
        [ TYPE_MATCH.ptr(), matchField ]).void());
    }

    this.buildRedirect(info, body, pos, this.buildNode(trie.next));
    return body;
  }

  buildRedirect(info, body, pos, target) {
    const call = IR._('tail call fastcc', [
      TYPE_OUTPUT, target, '(',
      this.state.ptr(), info.fn.arg(ARG_STATE), ',',
      TYPE_INPUT, pos, ',',
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

    const stateArg = info.fn.arg(ARG_STATE);

    const codeField = IR._('getelementptr', this.state,
      [ stateArg.type, stateArg ],
      [ I32, I32.v(0) ],
      [ I32, I32.v(this.state.lookup('error')) ]);
    body.push(codeField);

    const reasonField = IR._('getelementptr', this.state,
      [ stateArg.type, stateArg ],
      [ I32, I32.v(0) ],
      [ I32, I32.v(this.state.lookup('reason')) ]);
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
}
module.exports = Compiler;
