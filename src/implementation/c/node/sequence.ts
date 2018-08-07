import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

export class Sequence extends Node<frontend.node.Sequence> {
  public doBuild(out: string[]): void {
    const ctx = this.compilation;

    const otherwise = this.ref.otherwise!;

    this.prologue(out);

    const matchSequence = ctx.getMatchSequence(this.ref.transform!,
        this.ref.select);

    out.push('llparse_match_t match;');
    out.push('');
    out.push(`match = ${matchSequence}(${ctx.stateArg()}, ${ctx.posArg()}, ` +
        `${ctx.endPosArg()}, ${ctx.blob(this.ref.select)}, ` +
        `${this.ref.select.length});`);

    out.push('switch (match.status) {');
    out.push('  case kMatchPause:');
    out.push('  case kMatchMismatch:');
    out.push('  case kMatchComplete:');
    out.push('}');

    this.tailTo(out, otherwise);
  }
}
