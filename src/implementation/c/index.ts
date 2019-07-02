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
    const compilation = new Compilation(info.prefix, info.properties,
        info.resumptionTargets, this.options);
    const out: string[] = [];

    out.push('#include <stdlib.h>');
    out.push('#include <stdint.h>');
    out.push('#include <string.h>');
    out.push('');

    // NOTE: Inspired by https://github.com/h2o/picohttpparser
    // TODO(indutny): Windows support for SSE4.2.
    // See: https://github.com/nodejs/llparse/pull/24#discussion_r299789676
    // (There is no `__SSE4_2__` define for MSVC)
    out.push('#ifdef __SSE4_2__');
    out.push(' #ifdef _MSC_VER');
    out.push('  #include <nmmintrin.h>');
    out.push(' #else  /* !_MSC_VER */');
    out.push('  #include <x86intrin.h>');
    out.push(' #endif  /* _MSC_VER */');
    out.push('#endif  /* __SSE4_2__ */');
    out.push('');

    out.push('#ifdef _MSC_VER');
    out.push(' #define ALIGN(n) _declspec(align(n))');
    out.push('#else  /* !_MSC_VER */');
    out.push(' #define ALIGN(n) __attribute__((aligned(n)))');
    out.push('#endif  /* _MSC_VER */');

    out.push('');
    out.push(`#include "${this.options.header || info.prefix}.h"`);
    out.push(``);
    out.push(`typedef int (*${info.prefix}__span_cb)(`);
    out.push(`             ${info.prefix}_t*, const char*, const char*);`);
    out.push('');

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
    compilation.buildResumptionStates(tmp);
    compilation.indent(out, tmp, '    ');

    out.push('    default:');
    out.push('      /* UNREACHABLE */');
    out.push('      abort();');
    out.push('  }');

    tmp = [];
    compilation.buildInternalStates(tmp);
    compilation.indent(out, tmp, '  ');

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

    const args = [
      compilation.stateArg(),
      `(const unsigned char*) ${compilation.posArg()}`,
      `(const unsigned char*) ${compilation.endPosArg()}`,
    ];
    out.push(`  next = ${info.prefix}__run(${args.join(', ')});`);
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
