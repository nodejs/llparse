import * as frontend from 'llparse-frontend';

import {
  ARG_STATE, ARG_POS, ARG_ENDPOS,
  STATE_ERROR,
  VAR_MATCH,
  CONTAINER_KEY,
} from './constants';
import { Compilation } from './compilation';
import code from './code';
import node from './node';
import { Node } from './node';
import transform from './transform';

export interface IJSCompilerOptions {
  readonly debug?: string;

  // TODO(indutny): remove this
  readonly header?: string;
}

export class JSCompiler {
  constructor(container: frontend.Container,
              public readonly options: IJSCompilerOptions) {
    container.add(CONTAINER_KEY, { code, node, transform });
  }

  public compile(info: frontend.IFrontendResult): string {
    const ctx = new Compilation(info.prefix, info.properties,
        info.resumptionTargets, this.options);
    const out: string[] = [];

    // Queue span callbacks to be built before `executeSpans()` code gets called
    // below.
    ctx.reserveSpans(info.spans);

    const root = info.root as frontend.ContainerWrap<frontend.node.Node>;
    const rootState = root.get<Node<frontend.node.Node>>(CONTAINER_KEY)
        .build(ctx);

    ctx.buildGlobals(out);
    out.push('');

    out.push('export default class Parser {');
    out.push('  constructor() {');
    out.push(`    ${ctx.currentField()} = ${rootState};`);
    out.push('  }');
    out.push('');

    // Run

    out.push(`  _run(${ctx.bufArg()}, ${ctx.offArg()}) {`);
    out.push('  }');
    out.push('');

    // Execute

    out.push(`  execute(${ctx.bufArg()}) {`);
    out.push(`    return this._run(${ctx.bufArg()}, 0);`);
    out.push('  }');

    out.push('}');

    out.push(`int ${info.prefix}_init(${info.prefix}_t* ${ARG_STATE}) {`);
    out.push(`  memset(${ARG_STATE}, 0, sizeof(*${ARG_STATE}));`);
    out.push(`  ${ARG_STATE}->_current = (void*) (intptr_t) ${rootState};`);
    out.push('  return 0;');
    out.push('}');
    out.push('');

    out.push(`static llparse_state_t ${info.prefix}__run(`);
    out.push(`    ${info.prefix}_t* ${ARG_STATE},`);
    out.push(`    const unsigned char* ${ARG_POS},`);
    out.push(`    const unsigned char* ${ARG_ENDPOS}) {`);
    out.push(`  int ${VAR_MATCH};`);
    out.push(`  switch ((llparse_state_t) (intptr_t) ${ctx.currentField()}) {`);

    let tmp: string[] = [];
    ctx.buildResumptionStates(tmp);
    ctx.indent(out, tmp, '    ');

    out.push('    default:');
    out.push('      /* UNREACHABLE */');
    out.push('      abort();');
    out.push('  }');

    tmp = [];
    ctx.buildInternalStates(tmp);
    ctx.indent(out, tmp, '  ');

    out.push('}');
    out.push('');


    out.push(`int ${info.prefix}_execute(${info.prefix}_t* ${ARG_STATE}, ` +
             `const char* ${ARG_POS}, const char* ${ARG_ENDPOS}) {`);
    out.push('  llparse_state_t next;');
    out.push('');

    out.push('  /* check lingering errors */');
    out.push(`  if (${ctx.errorField()} != 0) {`);
    out.push(`    return ${ctx.errorField()};`);
    out.push('  }');
    out.push('');

    tmp = [];
    this.restartSpans(ctx, info, tmp);
    ctx.indent(out, tmp, '  ');

    const args = [
      ctx.stateArg(),
      `(const unsigned char*) ${ctx.posArg()}`,
      `(const unsigned char*) ${ctx.endPosArg()}`,
    ];
    out.push(`  next = ${info.prefix}__run(${args.join(', ')});`);
    out.push(`  if (next == ${STATE_ERROR}) {`);
    out.push(`    return ${ctx.errorField()};`);
    out.push('  }');
    out.push(`  ${ctx.currentField()} = (void*) (intptr_t) next;`);
    out.push('');

    tmp = [];
    this.executeSpans(ctx, info, tmp);
    ctx.indent(out, tmp, '  ');

    out.push('  return 0;');
    out.push('}');

    return out.join('\n');
  }

  private restartSpans(ctx: Compilation, info: frontend.IFrontendResult,
                       out: string[]): void {
    if (info.spans.length === 0) {
      return;
    }

    out.push('/* restart spans */');
    for (const span of info.spans) {
      const posField = ctx.spanPosField(span.index);

      out.push(`if (${posField} != NULL) {`);
      out.push(`  ${posField} = (void*) ${ctx.posArg()};`);
      out.push('}');
    }
    out.push('');
  }

  private executeSpans(ctx: Compilation, info: frontend.IFrontendResult,
                       out: string[]): void {
    if (info.spans.length === 0) {
      return;
    }

    out.push('/* execute spans */');
    for (const span of info.spans) {
      const posField = ctx.spanPosField(span.index);
      let callback: string;
      if (span.callbacks.length === 1) {
        callback = ctx.buildCode(ctx.unwrapCode(span.callbacks[0]));
      } else {
        callback = `(${info.prefix}__span_cb) ` + ctx.spanCbField(span.index);
        callback = `(${callback})`;
      }

      const args = [
        ctx.stateArg(), posField, `(const char*) ${ctx.endPosArg()}`,
      ];

      out.push(`if (${posField} != NULL) {`);
      out.push('  int error;');
      out.push('');
      out.push(`  error = ${callback}(${args.join(', ')});`);

      // TODO(indutny): de-duplicate this here and in SpanEnd
      out.push('  if (error != 0) {');
      out.push(`    ${ctx.errorField()} = error;`);
      out.push(`    ${ctx.errorPosField()} = ${ctx.endPosArg()};`);
      out.push('    return error;');
      out.push('  }');
      out.push('}');
    }
    out.push('');
  }
}
