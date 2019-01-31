import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import {
  SEQUENCE_COMPLETE, SEQUENCE_MISMATCH, SEQUENCE_PAUSE,
} from '../constants';
import { Node } from './base';

export class Sequence extends Node<frontend.node.Sequence> {
  public doBuild(out: string[]): void {
    const ctx = this.compilation;

    out.push('llparse_match_t match_seq;');
    out.push('');

    this.prologue(out);

    const matchSequence = ctx.getMatchSequence(this.ref.transform!,
        this.ref.select);

    out.push(`match_seq = ${matchSequence}(${ctx.stateArg()}, ` +
        `${ctx.posArg()}, ` +
        `${ctx.endPosArg()}, ${ctx.blob(this.ref.select)}, ` +
        `${this.ref.select.length});`);
    out.push('p = match_seq.current;');

    let tmp: string[];

    out.push('switch (match_seq.status) {');

    out.push(`  case ${SEQUENCE_COMPLETE}: {`);
    tmp = [];
    this.tailTo(tmp, {
      noAdvance: false,
      node: this.ref.edge!.node,
      value: this.ref.edge!.value,
    });
    ctx.indent(out, tmp, '    ');
    out.push('  }');

    out.push(`  case ${SEQUENCE_PAUSE}: {`);
    tmp = [];
    this.pause(tmp);
    ctx.indent(out, tmp, '    ');
    out.push('  }');

    out.push(`  case ${SEQUENCE_MISMATCH}: {`);
    tmp = [];
    this.tailTo(tmp, this.ref.otherwise!);
    ctx.indent(out, tmp, '    ');
    out.push('  }');

    out.push('}');
  }
}
