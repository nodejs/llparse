'use strict';

const IR = require('llvm-ir');

const llparse = require('./');
const constants = llparse.constants;

const kType = llparse.symbols.kType;
const kFn = Symbol('fn');
const kLookup = Symbol('lookup');

const INT = constants.INT;

const ARG_STATE = constants.ARG_STATE;
const ARG_POS = constants.ARG_POS;
const ARG_ENDPOS = constants.ARG_ENDPOS;
const ARG_MATCH = constants.ARG_MATCH;

class Context {
  constructor(code, fn) {
    this[kFn] = fn;

    this.ret = this.fn.type.ret;
    this.state = fn.arg(ARG_STATE);
    this.pos = fn.arg(ARG_POS);
    this.endPos = fn.arg(ARG_ENDPOS);

    this.match = null;

    if (code[kType] === 'value')
      this.match = fn.arg(ARG_MATCH);
  }

  get fn() { return this[kFn]; }

  load(body, field) {
    body.comment(`load state[${field}]`);

    const lookup = this[kLookup](this[kFn], field);
    body.push(lookup.instr);

    const res = IR._('load', lookup.type, [ lookup.type.ptr(), lookup.instr ]);
    body.push(res);

    return res;
  }

  store(body, field, value) {
    body.comment(`store state[${field}] = ...`);

    const lookup = this[kLookup](this[kFn], field);
    body.push(lookup.instr);

    const res = IR._('store', [ lookup.type, value ],
      [ lookup.type.ptr(), lookup.instr ]);
    res.void();
    body.push(res);
  }

  [kLookup](fn, field) {
    const stateArg = fn.arg(ARG_STATE);
    const stateType = stateArg.type.to;

    const index = stateType.lookup(field);
    const instr = IR._('getelementptr', stateType,
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
