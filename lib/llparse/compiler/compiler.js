'use strict';

const assert = require('assert');

const llparse = require('../');
const constants = llparse.constants;

const kBody = llparse.symbols.kBody;
const kCases = llparse.symbols.kCases;
const kOtherwise = llparse.symbols.kOtherwise;
const kSignature = llparse.symbols.kSignature;
const kType = llparse.symbols.kType;

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
const ARG_UNUSED = constants.ARG_UNUSED;

const SEQUENCE_COMPLETE = constants.SEQUENCE_COMPLETE;
const SEQUENCE_PAUSE = constants.SEQUENCE_PAUSE;
const SEQUENCE_MISMATCH = constants.SEQUENCE_MISMATCH;

class Compiler {
  constructor(options) {
    this.options = Object.assign({}, options);

    this.prefix = this.options.prefix;

    this.nodeMap = new Map();
    this.codeMap = new Map();
    this.counter = new Map();

    // redirect blocks by `fn` and `target`
    this.redirectCache = new Map();
  }

  build(root) {
    const ctx = new llparse.compiler.Context(this.prefix, this.options, root);

    // TODO(indutny): detect and report loops

    const stages = [
      new llparse.compiler.MatchSequence(ctx),
      new llparse.compiler.span.Builder(ctx),
      new llparse.compiler.node.Translator(ctx),
      new llparse.compiler.node.Builder(ctx)
    ];

    ctx.buildStages(stages);

    this.buildInit(ctx);
    this.buildParse(ctx);

    return ctx.ir.build();
  }

  buildInit(ctx) {
    const fn = ctx.stageResults['node-builder'].ref();
    const sig = ctx.ir.signature(ctx.ir.void(), [ ctx.state.ptr() ]);
    const init = ctx.ir.fn(sig, this.prefix + '_init', [ ARG_STATE ]);

    const fields = {
      current: ctx.field(init, 'current'),
      error: ctx.field(init, 'error'),
      reason: ctx.field(init, 'reason'),
      index: ctx.field(init, 'index'),
      mark: ctx.field(init, 'mark'),
      data: ctx.field(init, 'data')
    };

    Object.keys(fields).forEach(key => init.body.push(fields[key]));

    const store = (field, type, value) => {
      init.body.push(ctx.ir._('store', [ type, value ],
        [ type.ptr(), field ]).void());
    };

    store(fields.current, fn.type, fn);
    store(fields.error, TYPE_ERROR, TYPE_ERROR.v(0));
    store(fields.reason, TYPE_REASON, TYPE_REASON.v(null));
    store(fields.index, TYPE_INDEX, TYPE_INDEX.v(0));
    store(fields.mark, TYPE_INPUT, TYPE_INPUT.v(null));
    store(fields.data, TYPE_DATA, TYPE_DATA.v(null));

    init.body.terminate('ret', ctx.ir.void());

    return init;
  }

  buildParse(ctx) {
    // TODO(indutny): change signature to (state*, start*, len)?
    const sig = ctx.ir.signature(TYPE_ERROR,
      [ ctx.state.ptr(), TYPE_INPUT, TYPE_INPUT ]);
    const parse = ctx.ir.fn(sig, this.prefix + '_execute',
      [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);

    const body = parse.body;

    const nodeSig = ctx.signature.node;

    const currentPtr = ctx.field(parse, 'current');
    body.push(currentPtr);
    const current = ctx.ir._('load', nodeSig.ptr(),
      [ nodeSig.ptr().ptr(), currentPtr ]);
    body.push(current);

    const call = ctx.ir._(`call ${CCONV}`, [
      TYPE_OUTPUT, current, '(',
      ctx.state.ptr(), parse.arg(ARG_STATE), ',',
      TYPE_INPUT, parse.arg(ARG_POS), ',',
      TYPE_INPUT, parse.arg(ARG_ENDPOS), ',',
      TYPE_MATCH, TYPE_MATCH.v(0),
      ')'
    ]);
    body.push(call);

    const errorPtr = ctx.field(parse, 'error');
    body.push(errorPtr);
    const error = ctx.ir._('load', TYPE_ERROR, [ TYPE_ERROR.ptr(), errorPtr ]);
    body.push(error);

    const bitcast = ctx.ir._('bitcast',
      [ TYPE_OUTPUT, call, 'to', nodeSig.ptr() ]);
    body.push(bitcast);
    body.push(ctx.ir._('store', [ nodeSig.ptr(), bitcast ],
      [ nodeSig.ptr().ptr(), currentPtr ]).void());

    body.terminate('ret', [ TYPE_ERROR, error ]);
  }

  // Helpers

  checkSignatureType(node, value) {
    assert.strictEqual(node[kSignature], value === null ? 'match' : 'value');
  }
}
module.exports = Compiler;
