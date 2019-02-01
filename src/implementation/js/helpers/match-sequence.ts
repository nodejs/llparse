import * as assert from 'assert';
import { Buffer } from 'buffer';
import * as frontend from 'llparse-frontend';

import {
  SEQUENCE_COMPLETE, SEQUENCE_MISMATCH, SEQUENCE_PAUSE,
} from '../constants';
import { Transform } from '../transform';
import { Compilation } from '../compilation';

type TransformWrap = Transform<frontend.transform.Transform>;

export class MatchSequence {
  constructor(private readonly transform: TransformWrap) {
  }

  public static buildGlobals(out: string[]): void {
    out.push(`const ${SEQUENCE_COMPLETE} = 0;`);
    out.push(`const ${SEQUENCE_PAUSE} = 1;`);
    out.push(`const ${SEQUENCE_MISMATCH} = 2;`);
  }

  public getName(): string {
    return `_match_sequence_${this.transform.ref.name}`;
  }

  public build(ctx: Compilation, out: string[]): void {
    const buf = ctx.bufArg();
    const off = ctx.offArg();

    out.push(`${this.getName()}(${buf}, ${off}, seq) {`);

    // Body
    out.push(`  let index = ${ctx.indexField()};`);
    out.push(`  for (; ${off} !== ${buf}.length; ${off}++) {`);
    const single = this.transform.build(ctx, `${buf}[${off}]`);
    out.push(`    const current = ${single};`);
    out.push('    if (current === seq[index]) {');
    out.push('      if (++index == seq.length) {');
    out.push(`        ${ctx.indexField()} = 0;`);
    out.push(`        ${ctx.statusField()} = ${SEQUENCE_COMPLETE};`);
    out.push('        return off;');
    out.push('      }');
    out.push('    } else {');
    out.push(`      ${ctx.indexField()} = 0;`);
    out.push(`      ${ctx.statusField()} = ${SEQUENCE_MISMATCH};`);
    out.push('      return off;');
    out.push('    }');
    out.push('  }');

    out.push(`  ${ctx.indexField()} = index;`);
    out.push(`  ${ctx.statusField()} = ${SEQUENCE_PAUSE};`);
    out.push('  return off;');
    out.push('}');
  }
}
