'use strict';

const llparse = require('../');
const constants = llparse.constants;

const TYPE_INPUT = constants.TYPE_INPUT;
const TYPE_OUTPUT = constants.TYPE_OUTPUT;
const TYPE_MATCH = constants.TYPE_MATCH;
const TYPE_ERROR = constants.TYPE_ERROR;

const ARG_STATE = constants.ARG_STATE;
const ARG_POS = constants.ARG_POS;
const ARG_ENDPOS = constants.ARG_ENDPOS;

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
    const ctx = new llparse.compiler.Compilation(this.prefix, this.options,
      root);

    // TODO(indutny): detect and report loops

    const stages = [
      new llparse.compiler.MatchSequence(ctx),
      new llparse.compiler.span.Allocator(ctx),
      new llparse.compiler.span.Builder(ctx),
      new llparse.compiler.node.Translator(ctx),
      new llparse.compiler.node.Builder(ctx)
    ];

    ctx.buildStages(stages);

    this.buildInit(ctx);
    this.buildExecute(ctx);

    return ctx.ir.build();
  }

  buildInit(ctx) {
    const sig = ctx.ir.signature(ctx.ir.void(), [ ctx.state.ptr() ]);
    const init = ctx.ir.fn(sig, this.prefix + '_init', [ ARG_STATE ]);

    ctx.initFields(init, init.body);

    init.body.terminate('ret', ctx.ir.void());

    return init;
  }

  buildExecute(ctx) {
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

    const call = ctx.call('', nodeSig, current, [
      ctx.stateArg(parse),
      ctx.posArg(parse),
      ctx.endPosArg(parse),
      TYPE_MATCH.v(0)
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
}
module.exports = Compiler;
