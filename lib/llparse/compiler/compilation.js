'use strict';

const assert = require('assert');
const IR = require('llvm-ir');

const llparse = require('../');
const compiler = require('./');
const constants = llparse.constants;

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

class Compilation {
  constructor(options) {
    this.options = Object.assign({}, options);

    this.ir = new IR();
    this.prefix = this.options.prefix;

    this.root = this.options.root;

    this.state = this.ir.struct(`${this.prefix}_state`);
    this.initializers = [];

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
        ]),
        span: null
      }
    };
    this.signature.callback.span = this.signature.callback.match;

    this.INVARIANT_GROUP = this.ir.metadata('!"llparse.invariant"');

    this.codeCache = new Map();
    this.debugMethod = null;

    this.namespace = new Set();

    // Intermediate results from various build stages
    this.stageResults = {};
  }

  id(name, prefix = '', postfix = '') {
    let res = prefix + name + postfix;
    if (this.namespace.has(res)) {
      let i;
      for (i = 1; i <= this.namespace.size; i++)
        if (!this.namespace.has(res + '_' + i))
          break;
      res += '_' + i;
    }

    this.namespace.add(res);
    return { name: res, sourceName: name };
  }

  build() {
    // Private fields
    this.declareField(this.signature.node.ptr(), '_current',
      (type, ctx) => ctx.stageResults['node-builder'].entry.ref());

    this.declareField(TYPE_INDEX, '_index', type => type.v(0));

    // Some stages may add more private fields
    this.buildStages(this.options.stages.before);

    // Public fields
    this.declareField(TYPE_ERROR, 'error', type => type.v(0));
    this.declareField(TYPE_REASON, 'reason', type => type.v(null));
    this.declareField(TYPE_INPUT, 'error_pos', type => type.v(null));
    this.declareField(TYPE_DATA, 'data', type => type.v(null));

    // Custom fields
    this.options.properties.forEach((prop) => {
      this.declareField(prop.type, prop.name, (type) => {
        if (type.isPointer())
          return type.v(null);
        else
          return type.v(0);
      });
    });

    // Some stages may add more private fields
    this.buildStages(this.options.stages.after);
  }

  buildCState() {
    const out = [];

    out.push(`typedef struct ${this.prefix}_state_s ${this.prefix}_state_t;`);
    out.push(`struct ${this.prefix}_state_s {`);

    this.state.fields.forEach((field) => {
      let type = field.type;
      if (type.isPointer()) {
        if (field.name === 'error_pos' || field.name === 'reason')
          type = 'const char*';
        else
          type = 'void*';
      } else {
        assert(type.isInt(), 'Unsupported type: ' + type.type);
        if (type.width === 8)
          type = 'uint8_t';
        else if (type.width === 16)
          type = 'uint16_t';
        else if (type.width === 32)
          type = 'uint32_t';
        else if (type.width === 64)
          type = 'uint64_t';
        else
          throw new Error('Unsupported type width: ' + type.width);
      }

      out.push(`  ${type} ${field.name};`);
    });

    out.push('};');

    return out.join('\n');
  }

  buildStages(stages) {
    stages.forEach(Stage => this.buildStage(Stage));
  }

  buildStage(Stage) {
    const stage = new Stage(this);
    this.stageResults[stage.name] = stage.build();
  }

  // TODO(indutny): find better place for it?
  translateCode(code) {
    // User callbacks
    if (code instanceof llparse.code.Match)
      return new compiler.code.Match(code.name);
    else if (code instanceof llparse.code.Value)
      return new compiler.code.Value(code.name);
    else if (code instanceof llparse.code.Span)
      return new compiler.code.Span(code.name);

    // Internal helpers
    let name = code.name;
    if (code.field)
      name += '_' + code.field;

    const id = this.id(name, 'c_').name;
    if (code instanceof llparse.code.IsEqual)
      return new compiler.code.IsEqual(id, code.field, code.value);
    else if (code instanceof llparse.code.Load)
      return new compiler.code.Load(id, code.field);
    else if (code instanceof llparse.code.MulAdd)
      return new compiler.code.MulAdd(id, code.field, code.options);
    else if (code instanceof llparse.code.Or)
      return new compiler.code.Or(id, code.field, code.value);
    else if (code instanceof llparse.code.Store)
      return new compiler.code.Store(id, code.field);
    else if (code instanceof llparse.code.Test)
      return new compiler.code.Test(id, code.field, code.value);
    else if (code instanceof llparse.code.Update)
      return new compiler.code.Update(id, code.field, code.value);
    else
      throw new Error('Unexpected code type of: ' + code.name);
  }

  buildCode(code) {
    const native = this.translateCode(code);

    const signatures = this.signature.callback;
    const signature = native.signature === 'match' ?
      signatures.match : signatures.value;

    const cacheKey = native.cacheKey;
    if (this.codeCache.has(cacheKey)) {
      const cached = this.codeCache.get(cacheKey);
      assert.strictEqual(cached.type, signature,
        `Conflicting code entries for "${native.name}"`);
      return cached;
    }

    let fn;
    if (native.isExternal) {
      const external = this.ir.declare(signature, native.name);

      // NOTE: this has no effect due to machine-specific flags
      // TODO(indutny): find a way to make it inline the function
      external.attributes = 'alwaysinline';

      fn = external;
    } else {
      fn = this.buildCodeWithBody(native, signature);
    }

    this.codeCache.set(cacheKey, fn);
    return fn;
  }

  buildCodeWithBody(code, signature) {
    const args = [ ARG_STATE, ARG_POS, ARG_ENDPOS ];

    if (code.signature === 'value')
      args.push(ARG_MATCH);

    const fn = this.ir.fn(signature, this.prefix + '_' + code.name, args);

    fn.visibility = 'internal';
    fn.cconv = CCONV;
    fn.attributes = 'nounwind norecurse ssp uwtable';

    code.build(this, fn);

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

      // These are ABI dependent, but should bring us close to C-function
      // inlining on x86_64 through -flto
      fn.attributes += ' ssp uwtable';
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

  call(type, signature, ref, cconv, args) {
    if (Array.isArray(cconv)) {
      args = cconv;
      cconv = ref.cconv || '';
    }
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

    if (cconv)
      cconv = ' ' + cconv;

    const res = IR._(`${type}call${cconv}`, irArgs);
    if (signature.ret.isVoid())
      res.void();
    return res;
  }

  toBranchWeight(value) {
    if (value === 'likely')
      return 0x10000;
    else if (value === 'unlikely')
      return 0x1;

    assert.strictEqual(value, value | 0);
    return value;
  }

  branch(body, cmp, weights) {
    const extra = [];
    if (weights) {
      assert(Array.isArray(weights));
      assert.strictEqual(weights.length, 2);

      weights = weights.map(w => this.toBranchWeight(w));
      const meta = this.ir.metadata(
        `!"branch_weights", i32 ${weights[0]}, i32 ${weights[1]}`);
      extra.push([ '!prof', meta ]);
    }
    const branches = body.terminate('br', [ BOOL, cmp ],
      this.ir.label('true'),
      this.ir.label('false'),
      ...extra);

    return {
      left: branches[0],
      right: branches[1]
    };
  }

  buildSwitch(body, type, what, values, weights) {
    const cases = [];
    cases.push(IR.label('otherwise'));
    cases.push('[');
    values.forEach((value, i) => {
      cases.push(type, type.v(value));
      cases.push(',', IR.label(`case_${i}`));
    });
    cases.push(']');

    const extra = [];

    if (weights) {
      assert(Array.isArray(weights));
      assert.strictEqual(weights.length, 1 + values.length);

      weights = weights.map(w => 'i32 ' + this.toBranchWeight(w));
      const meta = this.ir.metadata(
        `!"branch_weights", ${weights.join(', ')}`);
      extra.push([ '!prof', meta ]);
    }

    const blocks = body.terminate('switch', [ type, what ], cases, ...extra);

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

  buildTransform(transform, body, current) {
    body.comment(`transform[${transform.name}]`);
    if (transform.name === 'to_lower_unsafe') {
      current = this.ir._('or', [ TYPE_INPUT.to, current ],
        TYPE_INPUT.to.v(0x20));
      body.push(current);
    } else {
      throw new Error('Unsupported transform: ' + transform.name);
    }

    return { body, current };
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

  load(fn, body, field) {
    body.comment(`load state[${field}]`);

    const lookup = this.lookup(fn, field);
    body.push(lookup.instr);

    const res = this.ir._('load', lookup.type,
      [ lookup.type.ptr(), lookup.instr ]);
    body.push(res);

    return res;
  }

  store(fn, body, field, value) {
    body.comment(`store state[${field}] = ...`);

    const lookup = this.lookup(fn, field);
    body.push(lookup.instr);

    const res = this.ir._('store',
      [ lookup.type, value ],
      [ lookup.type.ptr(), lookup.instr ]);
    res.void();
    body.push(res);
  }

  lookup(fn, field) {
    const index = this.state.lookup(field);
    const instr = this.ir._('getelementptr inbounds', this.state,
      [ this.state.ptr(), this.stateArg(fn) ],
      [ INT, INT.v(0) ],
      [ INT, INT.v(index) ]);

    return {
      type: this.state.fields[index].type,
      instr
    };
  }

  declareField(type, name, init) {
    this.state.field(type, name);

    this.initializers.push({ type, name, init });
  }

  initFields(fn, body) {
    this.initializers.forEach((entry) => {
      const field = this.field(fn, entry.name);
      body.push(field);

      body.push(this.ir._('store', [ entry.type, entry.init(entry.type, this) ],
        [ entry.type.ptr(), field ]).void());
    });
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
module.exports = Compilation;
