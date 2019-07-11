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

    out.push('#if defined(__x86_64__) || defined(_M_AMD64)');
    out.push(' #ifdef _MSC_VER');
    out.push('  #include <intrin.h>');
    out.push('  #define cpuid(info, x) __cpuidex(info, x, 0)');
    out.push(' #else /* _MSC_VER (GCC, Clang, ICC) */');
    out.push('  #include <cpuid.h>');
    out.push('  static void cpuid(int info[4], int eax) {');
    out.push('    __cpuid_count(eax, 0, info[0], info[1], info[2], info[3]);');
    out.push('  }');
    out.push(' #endif /* _MSC_VER */');
    out.push('');
    out.push(' inline static int SupportsSSE42() {');
    out.push('   static int supported; /* 0=first call, 1=yes, -1=no */');
    out.push('   if (supported == 0) {');
    out.push('     int info[4];');
    out.push('     cpuid(info, 0);');
    out.push('     int nIds = info[0];');
    out.push('     if (nIds >= 1) {');
    out.push('       cpuid(info, 1);');
    out.push('       if ((info[2] & (1 << 20)) != 0) {');
    out.push('         supported = 1;');
    out.push('       } else {');
    out.push('         supported = -1;');
    out.push('       }');
    out.push('     }');
    out.push('   }');
    out.push('   return supported == 1;');
    out.push(' }');
    out.push('');
    out.push('#else /* defined(__x86_64__) || defined(_M_AMD64) */');
    out.push(' inline static int SupportsSSE42() {');
    out.push('   return 0;');
    out.push(' }');
    out.push('#endif /* defined(__x86_64__) || defined(_M_AMD64) */');
    out.push('');

    out.push('#ifdef _MSC_VER');
    out.push(' #define ALIGN(n) _declspec(align(n))');
    out.push('#else  /* !_MSC_VER */');
    out.push(' #define ALIGN(n) __attribute__((aligned(n)))');
    out.push('#endif  /* _MSC_VER */');
    out.push('');

    out.push('typedef int FindRanges1T(const unsigned char* p,');
    out.push('                         const unsigned char* a,');
    out.push('                         int nRanges);');
    out.push('FindRanges1T FindRanges1Dispatch;');
    out.push('FindRanges1T* findRanges1 = FindRanges1Dispatch;');
    out.push('');

    // SSE4.2-specific impl of findRanges1
    out.push('#if defined(__x86_64__) || defined(_M_AMD64)');
    out.push(' #ifdef __GNUC__');
    out.push('  #include <x86intrin.h>');
    out.push('  int findRanges1_SSE42(const unsigned char* p,');
    out.push('                        const unsigned char* a,');
    out.push('                        int nRanges) __attribute__ ((__target__ ("sse4.2")));');
    out.push(' #else /* __GNUC__ */')
    out.push('  #include <nmmintrin.h>');
    out.push(' #endif /* __GNUC__ */');
    out.push('');
    out.push(' int findRanges1_SSE42(const unsigned char* p,');
    out.push('                       const unsigned char* a,');
    out.push('                       int nRanges) {');
    out.push('   __m128i ranges;');
    out.push('   __m128i input;');
    out.push('');
    out.push('   input = _mm_loadu_si128((__m128i const*) p);');
    out.push('   ranges = _mm_loadu_si128((__m128i const*) a);');
    out.push('   return _mm_cmpestri(ranges, nRanges, input, 16,');
    out.push('     _SIDD_UBYTE_OPS | _SIDD_CMP_RANGES | ');
    out.push('       _SIDD_NEGATIVE_POLARITY);');
    out.push(' }');
    out.push('#else /* __x86_64__ */');
    out.push(' int findRanges1_SSE42(const unsigned char* p,');
    out.push('                       const unsigned char* a,');
    out.push('                       int nRanges);'); // declaration only
    out.push('#endif /* __x86_64__ */');
    out.push('');

    out.push('int findRanges1_NoSSE42(const unsigned char* p,');
    out.push('                        const unsigned char* a,');
    out.push('                        int nRanges) {');
    out.push('  return -1;')
    out.push('}');
    out.push('');
    
    // dispatch for findRanges1
    out.push('int FindRanges1Dispatch(const unsigned char* p, const unsigned char* a, int nRanges) {');
    out.push('  if (SupportsSSE42()) {');
    out.push('    findRanges1 = findRanges1_SSE42;');
    out.push('  } else {');
    out.push('    findRanges1 = findRanges1_NoSSE42;');
    out.push('  }');
    out.push('  return (*findRanges1)(p, a, nRanges);');
    out.push('}');
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
