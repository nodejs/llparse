import * as frontend from 'llparse-frontend';

import {
  ARG_STATE, ARG_POS, ARG_ENDPOS,
  STATE_ERROR,
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
    const ctx = new Compilation(info.prefix, info.properties, this.options);
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
    out.push(`    ${ctx.indexField()} = 0;`);
    out.push(`    ${ctx.errorField()} = 0;`);
    out.push(`    ${ctx.errorOffField()} = 0;`);
    out.push('  }');
    out.push('');

    let tmp: string[] = [];
    ctx.buildMethods(tmp);
    ctx.indent(out, tmp, '  ');

    // Run

    out.push(`  _run(${ctx.currentArg()}, ${ctx.bufArg()}, ${ctx.offArg()}) {`);
    out.push(`    let ${ctx.matchVar()};`);
    out.push('    for (;;) {');
    out.push(`      switch (${ctx.currentArg()}) {`);

    tmp = [];
    ctx.buildStates(tmp);
    ctx.indent(out, tmp, '        ');

    out.push('      }');
    out.push('    }');
    out.push('    unreachable();');
    out.push('  }');
    out.push('');

    // Execute

    out.push(`  execute(${ctx.bufArg()}) {`);
    out.push('    // check lingering errors');
    out.push(`    if (${ctx.errorField()} !== 0) {`);
    out.push(`      return ${ctx.errorField()};`);
    out.push('    }');
    out.push('');

    tmp = [];
    this.restartSpans(ctx, info, tmp);
    ctx.indent(out, tmp, '    ');

    out.push(`    const next = this._run(` +
      `${ctx.currentField()}, ${ctx.bufArg()}, 0);`);
    out.push(`    if (next === ${STATE_ERROR}) {`);
    out.push(`      return ${ctx.errorField()};`);
    out.push('    }');
    out.push(`    ${ctx.currentField()} = next;`);
    out.push('');

    tmp = [];
    this.executeSpans(ctx, info, tmp);
    ctx.indent(out, tmp, '    ');

    out.push('    return 0;');

    out.push('  }');
    out.push('}');

    return out.join('\n');
  }

  private restartSpans(ctx: Compilation, info: frontend.IFrontendResult,
                       out: string[]): void {
    if (info.spans.length === 0) {
      return;
    }

    out.push('// restart spans');
    for (const span of info.spans) {
      const offField = ctx.spanOffField(span.index);

      out.push(`if (${offField} !== -1) {`);
      out.push(`  ${offField} = 0;`);
      out.push('}');
    }
    out.push('');
  }

  private executeSpans(ctx: Compilation, info: frontend.IFrontendResult,
                       out: string[]): void {
    if (info.spans.length === 0) {
      return;
    }

    out.push('// execute spans');
    for (const span of info.spans) {
      const offField = ctx.spanOffField(span.index);
      let callback: string;
      if (span.callbacks.length === 1) {
        callback = ctx.buildCode(ctx.unwrapCode(span.callbacks[0]));
      } else {
        callback = ctx.spanCbField(span.index);
      }

      const args = [
        ctx.stateVar(), ctx.bufArg(), offField, `${ctx.bufArg()}.length`,
      ];

      out.push(`if (${offField} !== -1) {`);
      out.push(`  const error = ${callback}.call(${args.join(', ')});`);

      // TODO(indutny): de-duplicate this here and in SpanEnd
      out.push('  if (error !== 0) {');
      out.push(`    ${ctx.errorField()} = error;`);
      out.push(`    ${ctx.errorOffField()} = ${ctx.bufArg()}.length;`);
      out.push('    return error;');
      out.push('  }');
      out.push('}');
    }
    out.push('');
  }
}
