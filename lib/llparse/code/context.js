'use strict';

const assert = require('assert');

const llparse = require('../');
const constants = llparse.constants;

const kType = llparse.symbols.kType;
const kFn = Symbol('fn');
const kCompilation = Symbol('compilation');
const kRet = Symbol('ret');
const kState = Symbol('state');
const kPos = Symbol('pos');
const kEndPos = Symbol('endPos');
const kMatch = Symbol('match');
const kLookup = Symbol('lookup');

const INT = constants.INT;

const ARG_STATE = constants.ARG_STATE;
const ARG_POS = constants.ARG_POS;
const ARG_ENDPOS = constants.ARG_ENDPOS;
const ARG_MATCH = constants.ARG_MATCH;

class Context {
  constructor(compilation, code, fn) {
    this[kCompilation] = compilation;
    this[kFn] = fn;

    this[kRet] = this.fn.type.ret;
    this[kState] = fn.arg(ARG_STATE);
    this[kPos] = fn.arg(ARG_POS);
    this[kEndPos] = fn.arg(ARG_ENDPOS);

    this[kMatch] = null;

    if (code[kType] === 'value')
      this[kMatch] = fn.arg(ARG_MATCH);
  }

  get fn() { return this[kFn]; }
  get ir() { return this[kCompilation].ir; }
  get ret() { return this[kRet]; }
  get state() { return this[kState]; }
  get pos() { return this[kPos]; }
  get endPos() { return this[kEndPos]; }
  get match() { return this[kMatch]; }

  load(body, field) {
    body.comment(`load state[${field}]`);

    const lookup = this[kLookup](field);
    body.push(lookup.instr);

    const res = this.ir._('load', lookup.type,
      [ lookup.type.ptr(), lookup.instr ]);
    body.push(res);

    return res;
  }

  store(body, field, value) {
    body.comment(`store state[${field}] = ...`);

    const lookup = this[kLookup](field);
    body.push(lookup.instr);

    const res = this.ir._('store',
      [ lookup.type, value ],
      [ lookup.type.ptr(), lookup.instr ]);
    res.void();
    body.push(res);
  }

  truncate(body, fromType, from, toType, isSigned = false) {
    assert(toType.isInt());
    assert(fromType.isInt());

    let res;

    // Same type!
    if (fromType.type === toType) {
      return from;
    // Extend
    } else if (fromType.width < toType.width) {
      if (isSigned)
        res = this.ir._('sext', [ fromType, from, 'to', toType ]);
      else
        res = this.ir._('zext', [ fromType, from, 'to', toType ]);
    // Truncate
    } else {
      assert(fromType.width > toType.width);
      res = this.ir._('trunc', [ fromType, from, 'to', toType ]);
    }

    body.push(res);
    return res;
  }

  call(...args) { return this[kCompilation].call(...args); }
  branch(...args) { return this[kCompilation].branch(...args); }

  [kLookup](field) {
    const stateArg = this.state;
    const stateType = stateArg.type.to;

    const index = stateType.lookup(field);
    const instr = this.ir._('getelementptr inbounds', stateType,
      [ stateArg.type, stateArg ],
      [ INT, INT.v(0) ],
      [ INT, INT.v(index) ]);

    return {
      type: stateType.fields[index].type,
      instr
    };
  }
}
module.exports = Context;
