'use strict';

const llparse = require('../');
const constants = llparse.constants;

const BOOL = constants.BOOL;

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
    const compOptions = Object.assign({}, this.options, {
      root,

      before: [
        llparse.compiler.node.Translator,
        llparse.compiler.span.Allocator
      ],
      after: [
        llparse.compiler.MatchSequence,
        llparse.compiler.span.Builder,
        llparse.compiler.node.Builder
      ]
    });

    const ctx = new llparse.compiler.Compilation(compOptions);

    // TODO(indutny): make these stages?
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
    const execute = ctx.ir.fn(sig, this.prefix + '_execute',
      [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);

    let body = execute.body;

    // Set unfinished spans
    body = ctx.stageResults['span-builder'].preExecute(execute, body);
    body.name = 'execute';

    body.comment('execute');

    const nodeSig = ctx.signature.node;

    const currentPtr = ctx.field(execute, 'current');
    body.push(currentPtr);
    const current = ctx.ir._('load', nodeSig.ptr(),
      [ nodeSig.ptr().ptr(), currentPtr ]);
    body.push(current);

    const call = ctx.call('', nodeSig, current, constants.CCONV, [
      ctx.stateArg(execute),
      ctx.posArg(execute),
      ctx.endPosArg(execute),
      TYPE_MATCH.v(0)
    ]);
    body.push(call);

    const cmp = ctx.ir._('icmp', [ 'ne', nodeSig.ret, call ],
      nodeSig.ret.v(null));
    body.push(cmp);

    const branch = body.branch('br', [ BOOL, cmp ]);
    const success = branch.left;
    const error = branch.right;

    // Success
    success.name = 'success';

    const bitcast = ctx.ir._('bitcast',
      [ TYPE_OUTPUT, call, 'to', nodeSig.ptr() ]);
    success.push(bitcast);
    success.push(ctx.ir._('store', [ nodeSig.ptr(), bitcast ],
      [ nodeSig.ptr().ptr(), currentPtr ]).void());

    // Invoke spans and exit
    ctx.stageResults['span-builder'].postExecute(execute, success)
      .terminate('ret', [ TYPE_ERROR, TYPE_ERROR.v(0) ]);

    // Error
    error.name = 'error';

    const errorPtr = ctx.field(execute, 'error');
    error.push(errorPtr);
    const code = ctx.ir._('load', TYPE_ERROR, [ TYPE_ERROR.ptr(), errorPtr ]);
    error.push(code);

    error.push(ctx.ir._('store', [ nodeSig.ptr(), nodeSig.ptr().v(null) ],
      [ nodeSig.ptr().ptr(), currentPtr ]).void());

    error.terminate('ret', [ TYPE_ERROR, code ]);
  }
}
module.exports = Compiler;
