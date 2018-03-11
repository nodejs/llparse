'use strict';

const assert = require('assert');
const bitcode = require('bitcode');

const llparse = require('../');
const compiler = require('./');
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

class Compilation {
  constructor(options) {
    this.options = Object.assign({}, options);

    this.bitcode = new bitcode.Module();
    this.ir = this.bitcode.createBuilder();
    this.prefix = this.options.prefix;

    this.root = this.options.root;

    this.state = this.ir.struct(`${this.prefix}_state`);
    this.initializers = [];

    this.signature = {
      node: this.ir.signature(TYPE_OUTPUT, [
        this.state.ptr(),
        TYPE_INPUT,
        TYPE_INPUT,
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

    this.INVARIANT_GROUP = this.ir.metadata([
      this.ir.metadata('llparse.invariant')
    ]);

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
      (type, ctx) => ctx.stageResults['node-builder'].entry);

    this.declareField(TYPE_INDEX, '_index', type => type.val(0));

    // Some stages may add more private fields
    this.buildStages(this.options.stages.before);

    // Public fields
    this.declareField(TYPE_ERROR, 'error', type => type.val(0));
    this.declareField(TYPE_REASON, 'reason', type => type.val(null));
    this.declareField(TYPE_INPUT, 'error_pos', type => type.val(null));
    this.declareField(TYPE_DATA, 'data', type => type.val(null));

    // Custom fields
    this.options.properties.forEach((prop) => {
      this.declareField(prop.type, prop.name, (type) => {
        if (type.isPointer())
          return type.val(null);
        else
          return type.val(0);
      });
    });

    // Lock up the struct
    this.state.finalize();

    // Some stages may add more private fields
    this.buildStages(this.options.stages.after);
  }

  end() {
    return this.bitcode.build(this.ir);
  }

  buildCState() {
    const out = [];

    out.push(`typedef struct ${this.prefix}_state_s ${this.prefix}_state_t;`);
    out.push(`struct ${this.prefix}_state_s {`);

    this.state.fields.forEach((field) => {
      let type = field.ty;
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

  declareFunction(signature, name) {
    const res = signature.declareFunction(name);
    this.bitcode.add(res);
    return res;
  }

  defineFunction(signature, name, paramNames) {
    const res = signature.defineFunction(name, paramNames);
    this.bitcode.add(res);
    return res;
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
      assert(cached.ty.isEqual(signature),
        `Conflicting code entries for "${native.name}"`);
      return cached;
    }

    let fn;
    if (native.isExternal) {
      const external = this.declareFunction(signature, native.name);

      // NOTE: this has no effect due to machine-specific flags
      // TODO(indutny): find a way to make it inline the function
      external.attrs.add('alwaysinline');

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

    const fn = this.defineFunction(signature, this.prefix + '_' + code.name,
      args);

    fn.linkage = 'internal';
    fn.cconv = CCONV;
    fn.attrs.add([ 'nounwind', 'norecurse', 'ssp', 'uwtable' ]);

    code.build(this, fn);

    return fn;
  }

  cstring(string) {
    return this.addGlobalConst('cstr', this.ir.cstring(string));
  }

  blob(data) {
    return this.addGlobalConst('blob', this.ir.blob(data));
  }

  addGlobalConst(name, value) {
    const id = this.id(name, 'g_').name;
    const glob = this.ir.global(value.ty.ptr(), id, value);
    glob.linkage = 'internal';
    glob.markConstant();
    this.bitcode.add(glob);
    return glob;
  }

  debug(fn, body, string) {
    if (!this.options.debug)
      return body;

    const str = this.cstring(string);
    const cast = body.getelementptr(str, INT.val(0), INT.val(0));

    // Lazily declare debug method
    if (this.debugMethod === null) {
      const sig = this.ir.signature(this.ir.void(),
        [ this.state.ptr(), TYPE_INPUT, TYPE_INPUT, TYPE_INPUT ]);

      this.debugMethod = this.declareFunction(sig, this.options.debug);
    }

    const args = [
      this.stateArg(fn),
      this.posArg(fn),
      this.endPosArg(fn),
      cast
    ];

    body.call(this.debugMethod, args);

    return body;
  }

  fn(signature, name) {
    name = this.prefix + '__' + name;

    let fn;
    if (signature === this.signature.node) {
      fn = this.defineFunction(this.signature.node, name,
        [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_MATCH ]);

      // TODO(indutny): reassess `minsize`. Looks like it gives best performance
      // results right now, though.
      fn.attrs.add([ 'nounwind', 'minsize' ]);

      // These are ABI dependent, but should bring us close to C-function
      // inlining on x86_64 through -flto
      fn.attrs.add([ 'ssp', 'uwtable' ]);

      fn.paramAttrs[0].add(ATTR_STATE);
      fn.paramAttrs[1].add(ATTR_POS);
      fn.paramAttrs[2].add(ATTR_ENDPOS);
    } else if (signature === this.signature.callback.match) {
      fn = this.defineFunction(this.signature.callback.match, name,
        [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);
    } else if (signature === this.signature.callback.value) {
      fn = this.defineFunction(this.signature.callback.match, name,
        [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_MATCH ]);
    } else {
      throw new Error('Unknown signature: ' + signature);
    }

    fn.linkage = 'internal';
    fn.cconv = CCONV;

    return fn;
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
    const onTrue = body.parent.createBlock('true');
    const onFalse = body.parent.createBlock('false');
    const branch = body.branch(cmp, onTrue, onFalse);

    if (weights) {
      assert(Array.isArray(weights));
      assert.strictEqual(weights.length, 2);

      weights = weights.map(w => this.toBranchWeight(w));
      const meta = this.ir.metadata([
        this.ir.metadata('branch_weights'),
        this.ir.metadata(INT.val(weights[0])),
        this.ir.metadata(INT.val(weights[1]))
      ]);
      branch.metadata.set('prof', meta);
    }

    // TODO(indutny): rename `left`/`right` to `onTrue`/`onFalse`
    return {
      left: onTrue,
      right: onFalse
    };
  }

  buildSwitch(body, what, values, weights) {
    const cases = [];
    const blocks = [];
    values.forEach((value, i) => {
      const block = body.parent.createBlock(`case_${i}`);
      blocks.push(block);
      cases.push({
        value: what.ty.val(value),
        block,
      });
    });

    const otherwise = body.parent.createBlock('otherwise');
    const sw = body.switch(what, otherwise, cases);

    if (weights) {
      assert(Array.isArray(weights));
      assert.strictEqual(weights.length, 1 + values.length);

      weights = weights.map((weight) => {
        return this.ir.metadata(INT.val(this.toBranchWeight(weight)));
      });

      const meta = this.ir.metadata([
        this.ir.metadata('branch_weights')
      ].concat(weights));
      sw.metadata.set('prof', meta);
    }

    return {
      otherwise,
      cases: blocks
    };
  }

  buildTransform(transform, body, current) {
    if (transform.name === 'to_lower_unsafe') {
      current = body.binop('or', current, TYPE_INPUT.to.val(0x20));
    } else {
      throw new Error('Unsupported transform: ' + transform.name);
    }

    return { body, current };
  }

  truncate(body, from, toType, isSigned = false) {
    const fromTy = from.ty;
    assert(toType.isInt());
    assert(fromTy.isInt());

    let res;

    // Same type!
    if (fromTy.isEqual(toType)) {
      return from;
    // Extend
    } else if (fromTy.width < toType.width) {
      if (isSigned)
        res = body.cast('sext', from, toType);
      else
        res = body.cast('zext', from, toType);
    // Truncate
    } else {
      assert(fromTy.width > toType.width);
      res = body.cast('trunc', from, toType);
    }

    return res;
  }

  load(fn, body, field) {
    const lookup = this.stateField(fn, body, field);
    return body.load(lookup);
  }

  store(fn, body, field, value) {
    const lookup = this.stateField(fn, body, field);
    body.store(value, lookup);
  }

  declareField(type, name, init) {
    this.state.addField(type, name);

    this.initializers.push({ type, name, init });
  }

  initFields(fn, body) {
    this.initializers.forEach((entry) => {
      const field = this.stateField(fn, body, entry.name);
      body.store(entry.init(entry.type, this), field);
    });
  }

  stateField(fn, body, name) {
    const stateArg = this.stateArg(fn);

    return body.getelementptr(stateArg, INT.val(0),
      INT.val(this.state.lookupField(name).index), true);
  }

  stateArg(fn) { return fn.getArgument(ARG_STATE); }
  posArg(fn) { return fn.getArgument(ARG_POS); }
  endPosArg(fn) { return fn.getArgument(ARG_ENDPOS); }
  matchArg(fn) { return fn.getArgument(ARG_MATCH); }
}
module.exports = Compilation;
