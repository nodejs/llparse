'use strict';

const llparse = require('../');
const constants = llparse.constants;

const TYPE_INPUT = constants.TYPE_INPUT;
const TYPE_MATCH = constants.TYPE_MATCH;
const TYPE_ERROR = constants.TYPE_ERROR;

const ARG_STATE = constants.ARG_STATE;
const ARG_POS = constants.ARG_POS;
const ARG_ENDPOS = constants.ARG_ENDPOS;

const ATTR_STATE = constants.ATTR_STATE;
const ATTR_POS = constants.ATTR_POS;
const ATTR_ENDPOS = constants.ATTR_ENDPOS;

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
    const compOpts = Object.assign({}, this.options, {
      root,
      stages: {
        before: [
          llparse.compiler.stage.NodeTranslator,
          llparse.compiler.stage.MatchSequence,
          llparse.compiler.stage.NodeLoopChecker,
          llparse.compiler.stage.SpanAllocator,
          llparse.compiler.stage.SpanBuilder
        ],
        after: [
          llparse.compiler.stage.NodeBuilder
        ]
      }
    });
    const ctx = new llparse.compiler.Compilation(compOpts);

    ctx.build();

    const init = this.buildInit(ctx);
    const execute = this.buildExecute(ctx);

    const out = {
      header: '',
      bitcode: null
    };

    const def = 'LLPARSE_HEADER_' +
      this.prefix.toUpperCase().replace(/[^A-Z0-9]/g, '_');

    out.header += `#ifndef ${def}\n`;
    out.header += `#define ${def}\n`;
    out.header += '\n';
    out.header += '#include <stdint.h>\n';
    out.header += '\n';
    out.header += ctx.buildCState() + '\n';
    out.header += '\n';
    out.header += init + '\n';
    out.header += execute + '\n';
    out.header += '\n';
    out.header += `#endif  /* ${def} */\n`;

    out.bitcode = ctx.end();

    return out;
  }

  buildInit(ctx) {
    const sig = ctx.ir.signature(ctx.ir.void(), [ ctx.state.ptr() ]);
    const init = ctx.defineFunction(sig, this.prefix + '_init', [ ARG_STATE ]);
    init.paramAttrs[0].add(ATTR_STATE);

    ctx.initFields(init, init.body);

    init.body.ret();

    return `void ${this.prefix}_init(${this.prefix}_state_t* s);`;
  }

  buildExecute(ctx) {
    // TODO(indutny): change signature to (state*, start*, len)?
    const sig = ctx.ir.signature(TYPE_ERROR, [
      ctx.state.ptr(),
      TYPE_INPUT,
      TYPE_INPUT
    ]);
    const execute = ctx.defineFunction(sig, this.prefix + '_execute',
      [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);
    execute.paramAttrs[0].add(ATTR_STATE);
    execute.paramAttrs[1].add(ATTR_POS);
    execute.paramAttrs[2].add(ATTR_ENDPOS);

    let body = execute.body;

    // Set unfinished spans
    body = ctx.stageResults['span-builder'].preExecute(execute, body);
    body.name = 'execute';

    const nodeSig = ctx.signature.node;

    const currentPtr = ctx.stateField(execute, body, '_current');
    const current = body.load(currentPtr);

    const nodes = ctx.stageResults['node-builder'].map;
    let callees = new Set([ ctx.stageResults['node-builder'].entry ]);
    nodes.forEach((fn, node) => {
      // Only nodes that can pause can be present in `_current`
      node.getResumptionTargets().forEach((target) => {
        callees.add(nodes.get(target));
      });
    });
    callees = Array.from(callees).map((fn) => {
      return ctx.ir.metadata(fn);
    });

    const call = body.call(current, [
      ctx.stateArg(execute),
      ctx.posArg(execute),
      ctx.endPosArg(execute),
      TYPE_MATCH.undef()
    ], 'normal', constants.CCONV);
    call.metadata.set('callees', ctx.ir.metadata(callees));

    const cmp = body.icmp('ne', call, nodeSig.returnType.val(null));

    const branch = ctx.branch(body, cmp, [ 'likely', 'unlikely' ]);
    const success = branch.left;
    const error = branch.right;

    // Success
    success.name = 'success';

    const bitcast = success.cast('bitcast', call, nodeSig.ptr());
    success.store(bitcast, currentPtr);

    // Invoke spans and exit
    ctx.stageResults['span-builder'].postExecute(execute, success)
      .ret(TYPE_ERROR.val(0));

    // Error
    error.name = 'error';

    const errorPtr = ctx.stateField(execute, error, 'error');
    const code = error.load(errorPtr);
    error.ret(code);

    return `int ${this.prefix}_execute(${this.prefix}_state_t* s, ` +
           'const char* p, const char* endp);';
  }
}
module.exports = Compiler;
