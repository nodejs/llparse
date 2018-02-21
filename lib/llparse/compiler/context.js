'use strict';

const assert = require('assert');
const IR = require('llvm-ir');

const llparse = require('../');
const constants = llparse.constants;

const CCONV = constants.CCONV;

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

class Context {
  constructor(prefix, options) {
    this.ir = new IR();
    this.prefix = prefix;

    this.state = this.ir.struct(`${this.prefix}_state`);

    this.state.field(this.signature.node.ptr(), 'current');
    this.state.field(TYPE_ERROR, 'error');
    this.state.field(TYPE_REASON, 'reason');
    this.state.field(TYPE_INDEX, 'index');
    this.state.field(TYPE_INPUT, 'mark');

    // Public fields
    this.state.field(TYPE_DATA, 'data');

    // Custom fields
    this.options.properties.forEach((prop) => {
      this.state.field(prop.type(this.ir, this.state), prop.name);
    });

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
  }

  signature(name) {
    if (name === 'node')
      return this.signature.node;
    else if (name === 'callback.match')
      return this.signature.callback.match;
    else if (name === 'callback.value')
      return this.signature.callback.value;
    else
      throw new Error('Unknown signature: ' + signature);
  }

  fn(signature, name) {
    name = this.prefix + '__' + name;

    let fn;
    if (signature === 'node') {
      fn = this.ir.fn(this.signature.node, name,
        [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_MATCH ]);
    } else if (signature === 'callback.match') {
      fn = this.ir.fn(this.signature.callback.match, name,
        [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);
    } else if (signature === 'callback.value') {
      fn = this.ir.fn(this.signature.callback.match, name,
        [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_MATCH ]);
    } else {
      throw new Error('Unknown signature: ' + signature);
    }

    fn.visibility = 'internal';
    fn.cconv = CCONV;

    return fn;
  }

  call(type, signature, ref, args) {
    signature = this.signature(name);
    assert.strictEqual(args.length, signature.args.length);

    const irArgs = [ signature.ret, ref, '(' ];
    args.forEach((arg, i) => {
      const isLast = i === args.length - 1;
      irArgs.push(signature.args[i], arg);
      if (!isLast)
        irArgs.push(',');
    });
    irArgs.push(')');

    if (type)
      type += ' ';

    let cconv = ref.cconv;
    if (cconv)
      cconv = ' ' + cconv;

    return IR._(`${type}call${cconv}`, args);
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

  field(fn, name) {
    const stateArg = this.state(fn);

    return IR._('getelementptr', this.state,
      [ stateArg.type, stateArg ],
      [ INT, INT.v(0) ],
      [ INT, INT.v(this.state.lookup(name)) ]);
  }

  state(fn) { return fn.arg(ARG_STATE); }
  pos(fn) { return fn.arg(ARG_POS); }
  endPos(fn) { return fn.arg(ARG_ENDPOS); }
  match(fn) { return fn.arg(ARG_MATCH); }
}
module.exports = Context;
