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

export interface ICCompilerOptions {
  readonly debug?: string;
  readonly header?: string;
}

export interface ICPublicOptions {
  readonly header?: string;
}

export class CCompiler {
  constructor(container: frontend.Container,
              public readonly options: ICCompilerOptions) {
    container.add(CONTAINER_KEY, { code, node, transform });
  }

  public compile(info: frontend.IFrontendResult): string {
    const compilation = new Compilation(info.prefix, info.properties);
    const out: string[] = [];

    out.push('#include <stdlib.h>');
    out.push('#include <stdint.h>');
    out.push('#include <string.h>');
    out.push('');
    out.push(`#include "${this.options.header || info.prefix}.h"`);
    out.push(``);

    // Queue span callbacks to be built before `executeSpans()` code gets called
    // below.
    compilation.reserveSpans(info.spans);

    const root = info.root as frontend.ContainerWrap<frontend.node.Node>;
    const rootState = root.get<Node<frontend.node.Node>>(CONTAINER_KEY)
        .build(compilation);

    compilation.buildGlobals(out);
    out.push('');

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
    out.push(`  switch ((llparse_state_t) (intptr_t) ` +
        `${compilation.currentField()}) {`);

    let tmp: string[] = [];
    compilation.buildStates(tmp);
    compilation.indent(out, tmp, '    ');

    out.push('    default:');
    out.push('      /* Unreachable */');
    out.push('      abort();');
    out.push('  }');
    out.push('}');
    out.push('');

    out.push(`int ${info.prefix}_execute(${info.prefix}_t* ${ARG_STATE}, ` +
             `const char* ${ARG_POS}, const char* ${ARG_ENDPOS}) {`);
    out.push('  llparse_state_t next;');
    out.push('');

    out.push('  /* check lingering errors */');
    out.push(`  if (${compilation.errorField()} != 0) {`);
    out.push(`    return ${compilation.errorField()};`);
    out.push('  }');
    out.push('');

    tmp = [];
    this.restartSpans(compilation, info, tmp);
    compilation.indent(out, tmp, '  ');

    out.push(`  next = llparse__run(${ARG_STATE}, ${ARG_POS}, ${ARG_ENDPOS});`);
    out.push(`  if (next == ${STATE_ERROR}) {`);
    out.push(`    return ${compilation.errorField()};`);
    out.push('  }');
    out.push(`  ${compilation.currentField()} = (void*) (intptr_t) next;`);
    out.push('');

    tmp = [];
    this.executeSpans(compilation, info, tmp);
    compilation.indent(out, tmp, '  ');

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
      out.push(`  ${posField} = ${ctx.posArg()};`);
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
      const callback = span.callbacks.length === 1 ?
          ctx.buildCode(ctx.unwrapCode(span.callbacks[0])) :
          ctx.spanCbField(span.index);

      const args = [
        ctx.stateArg(), posField, ctx.endPosArg(),
      ];

      out.push(`if (${posField} != NULL) {`);
      out.push('  int error;');
      out.push('');
      out.push(`  error = ${callback}(${args.join(', ')});`);

      // TODO(indutny): de-duplicate this here and in SpanEnd
      out.push('  if (error != 0) {');
      out.push(`    ${ctx.errorField()} = error;`);
      out.push(`    ${ctx.reasonField()} = "Span callback error";`);
      out.push(`    ${ctx.errorPosField()} = ${ctx.endPosArg()};`);
      out.push('  }');
      out.push('}');
    }
    out.push('');
  }
}
