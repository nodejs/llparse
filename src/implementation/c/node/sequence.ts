import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import {
  SEQUENCE_COMPLETE, SEQUENCE_MISMATCH, SEQUENCE_PAUSE,
} from '../constants';
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
    out.push(`  case ${SEQUENCE_PAUSE}:`);
    out.push(`  case ${SEQUENCE_MISMATCH}:`);
    out.push(`  case ${SEQUENCE_COMPLETE}:`);
    out.push('}');

    this.tailTo(out, otherwise);
  }
}
