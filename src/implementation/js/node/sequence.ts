import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import {
  SEQUENCE_COMPLETE, SEQUENCE_MISMATCH, SEQUENCE_PAUSE,
} from '../constants';
import { Node } from './base';

export class Sequence extends Node<frontend.node.Sequence> {
  public doBuild(out: string[]): void {
    const ctx = this.compilation;

    this.prologue(out);

    const matchSequence = ctx.getMatchSequence(this.ref.transform!,
        this.ref.select);

    out.push(`${ctx.offArg()} = ${matchSequence}(${ctx.bufArg()}, ` +
        `${ctx.offArg()}, ${ctx.blob(this.ref.select)})`);

    let tmp: string[];

    out.push(`const status = ${ctx.statusField()};`);

    out.push(`if (status === ${SEQUENCE_COMPLETE}) {`);

    tmp = [];
    this.tailTo(tmp, {
      noAdvance: false,
      node: this.ref.edge!.node,
      value: this.ref.edge!.value,
    });
    ctx.indent(out, tmp, '  ');

    out.push(`} else if (status === ${SEQUENCE_PAUSE}) {`);

    tmp = [];
    this.pause(tmp);
    ctx.indent(out, tmp, '  ');

    out.push('} else {');

    tmp = [];
    this.tailTo(tmp, this.ref.otherwise!);
    ctx.indent(out, tmp, '  ');

    out.push('}');
  }
}
