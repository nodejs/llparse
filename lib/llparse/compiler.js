'use strict';

const llparse = require('./');

const assert = require('assert');
const IR = require('llvm-ir');

const I32 = IR.i(32);
const TYPE_INPUT = IR.i(8).ptr();
const TYPE_OUTPUT = IR.i(8).ptr();
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
    this.state.field(TYPE_OUTPUT, 'current');

    this.nodeMap = new Map();
  }

  build(root) {
    // TODO(indutny): init function
    // TODO(indutny): parse function

    this.buildNode(root);

    return this.ir.build();
  }

  createFn(node, index) {
    const name = `${this.prefix}_${node.name}` +
      `${index === null ? '' : '_' + index}`;
    const fn = this.ir.fn(this.sig, name, [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);
    fn.visibility = 'internal fastcc';
    return fn;
  }

  buildNode(node) {
    if (this.nodeMap.has(node))
      return this.nodeMap.get(node);

    const fn = this.createFn(node, null);
    this.nodeMap.set(node, fn);

    const body = fn.body;

    const otherwise =
      node.cases.filter(c => c instanceof llparse.case.Otherwise);
    assert.strictEqual(otherwise.length, 1,
      `Node "${node.name}" must have only 1 \`.otherwise()\``);

    const trie = this.trie.combine(node.cases);

    this.buildRedirect(fn, body, otherwise[0].next);

    return fn;
  }

  buildRedirect(fn, body, to) {
    if (to instanceof llparse.node.Error)
      return this.buildError(fn, body, to);

    const target = this.buildNode(to).ref();
    const bitcast = IR._('bitcast', [ target.type, target, 'to', TYPE_OUTPUT ]);
    body.push(bitcast);
    return body.terminate('ret', [ TYPE_OUTPUT, bitcast ]);
  }

  buildError(fn, body, error) {
    const code = error.code;
    const reason = this.ir.cstr(error.reason);

    const stateArg = fn.arg(ARG_STATE);

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
