'use strict';

const assert = require('assert');
const IR = require('llvm-ir');

const llparse = require('../');
const constants = llparse.constants;

const kType = llparse.symbols.kType;
const kBody = llparse.symbols.kBody;

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

class Context {
  constructor(prefix, options, root) {
    this.options = options || {};

    this.ir = new IR();
    this.prefix = prefix;

    this.root = root;

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
    this.state.field(TYPE_INPUT, 'mark');

    this.codeCache = new Map();
    this.debugMethod = null;

    // Public fields
    this.state.field(TYPE_DATA, 'data');

    // Custom fields
    this.options.properties.forEach((prop) => {
      this.state.field(prop.type(this.ir, this.state), prop.name);
    });

    // Intermediate results from various build stages
    this.stageResults = {};
  }

  buildStages(stages) {
    stages.forEach(stage => this.buildStage(stage));
  }

  buildStage(stage) {
    this.stageResults[stage.name] = stage.build(this);
  }

  buildCode(code) {
    const signatures = this.signature.callback;
    const signature = code[kType] === 'match' ?
      signatures.match : signatures.value;

    const name = code.name;
    if (this.codeCache.has(name)) {
      const cached = this.codeCache.get(name);
      assert.strictEqual(cached.type, signature,
        `Conflicting code entries for "${name}"`);
      return cached;
    }

    let fn;
    if (code[kBody] === null) {
      const external = this.ir.declare(signature, name);

      // NOTE: this has no effect due to machine-specific flags
      // TODO(indutny): find a way to make it inline the function
      external.attributes = 'alwaysinline';

      fn = external;
    } else {
      fn = this.buildCodeWithBody(code, signature);
    }

    this.codeCache.set(name, fn);
    return fn;
  }

  buildCodeWithBody(code, signature) {
    const args = [ ARG_STATE, ARG_POS, ARG_ENDPOS ];

    if (code[kType] === 'value')
      args.push(ARG_MATCH);

    const fn = this.ir.fn(signature, code.name, args);

    fn.visibility = 'internal';
    fn.cconv = CCONV;
    fn.attributes = 'nounwind';

    const context = new llparse.code.Context(code, fn);

    code[kBody].call(fn.body, this.ir, context);

    return fn;
  }

  debug(fn, body, string) {
    if (!this.options.debug)
      return body;

    const str = this.ir.cstr(string);
    const cast = IR._('getelementptr inbounds', str.type.to, [ str.type, str ],
      [ INT, INT.v(0) ], [ INT, INT.v(0) ]);
    body.push(cast);

    // Lazily declare debug method
    if (this.debugMethod === null) {
      const sig = IR.signature(IR.void(),
        [ this.state.ptr(), TYPE_INPUT, TYPE_INPUT, TYPE_INPUT ]);

      this.debugMethod = this.ir.declare(sig, this.options.debug);
    }

    const args = [
      this.stateArg(fn),
      this.posArg(fn),
      this.endPosArg(fn),
      cast
    ];

    const call = this.call('', this.debugMethod.type, this.debugMethod, args);
    body.push(call);

    return body;
  }

  fn(signature, name) {
    name = this.prefix + '__' + name;

    let fn;
    if (signature === this.signature.node) {
      fn = this.ir.fn(this.signature.node, name,
        [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_MATCH ]);

      // TODO(indutny): reassess `minsize`. Looks like it gives best performance
      // results right now, though.
      fn.attributes = 'nounwind minsize';
    } else if (signature === this.signature.callback.match) {
      fn = this.ir.fn(this.signature.callback.match, name,
        [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);
    } else if (signature === this.signature.callback.value) {
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

    let cconv = ref.cconv || '';
    if (cconv)
      cconv = ' ' + cconv;

    const res = IR._(`${type}call${cconv}`, irArgs);
    if (signature.ret.isVoid())
      res.void();
    return res;
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
    const stateArg = this.stateArg(fn);

    return IR._('getelementptr inbounds', this.state,
      [ stateArg.type, stateArg ],
      [ INT, INT.v(0) ],
      [ INT, INT.v(this.state.lookup(name)) ]);
  }

  stateArg(fn) { return fn.arg(ARG_STATE); }
  posArg(fn) { return fn.arg(ARG_POS); }
  endPosArg(fn) { return fn.arg(ARG_ENDPOS); }
  matchArg(fn) { return fn.arg(ARG_MATCH); }
}
module.exports = Context;
