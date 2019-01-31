import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import {
  STATE_PREFIX, LABEL_PREFIX,
} from '../constants';

export interface INodeEdge {
  readonly node: frontend.IWrap<frontend.node.Node>;
  readonly noAdvance: boolean;
  readonly value?: number;
}

export abstract class Node<T extends frontend.node.Node> {
  protected cachedDecl: string | undefined;
  protected privCompilation: Compilation | undefined;

  constructor(public readonly ref: T) {
  }

  public build(compilation: Compilation): string {
    if (this.cachedDecl !== undefined) {
      return this.cachedDecl;
    }

    const res = STATE_PREFIX + this.ref.id.name;
    this.cachedDecl = res;

    this.privCompilation = compilation;

    const out: string[] = [];
    compilation.debug(out,
      `Entering node "${this.ref.id.originalName}" ("${this.ref.id.name}")`);
    this.doBuild(out);

    compilation.addState(res, out);

    return res;
  }

  protected get compilation(): Compilation {
    assert(this.privCompilation !== undefined);
    return this.privCompilation!;
  }

  protected prologue(out: string[]): void {
    const ctx = this.compilation;

    out.push(`if (${ctx.posArg()} == ${ctx.endPosArg()}) {`);

    const tmp: string[] = [];
    this.pause(tmp);
    this.compilation.indent(out, tmp, '  ');

    out.push('}');
  }

  protected pause(out: string[]): void {
    out.push(`return ${this.cachedDecl};`);
  }

  protected tailTo(out: string[], edge: INodeEdge): void {
    const ctx = this.compilation;
    const target = ctx.unwrapNode(edge.node).build(ctx);

    if (!edge.noAdvance) {
      out.push(`${ctx.posArg()}++;`);
    }
    if (edge.value !== undefined) {
      out.push(`${ctx.matchVar()} = ${edge.value};`);
    }
    out.push(`goto ${LABEL_PREFIX}${target};`);
  }

  protected abstract doBuild(out: string[]): void;
}
