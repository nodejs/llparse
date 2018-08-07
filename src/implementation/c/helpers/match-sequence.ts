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
    out.push('enum llparse_match_status_e {');
    out.push(`  ${SEQUENCE_COMPLETE},`);
    out.push(`  ${SEQUENCE_PAUSE},`);
    out.push(`  ${SEQUENCE_MISMATCH}`);
    out.push('};');
    out.push('typedef enum llparse_match_status_e llparse_match_status_t;');
    out.push('');
    out.push('struct llparse_match_s {');
    out.push('  llparse_match_status_t status;');
    out.push('  const unsigned char* current;');
    out.push('};');
    out.push('typedef struct llparse_match_s llparse_match_t;');
  }

  public getName(): string {
    return `llparse__match_sequence_${this.transform.ref.name}`;
  }

  public build(ctx: Compilation, out: string[]): void {
    out.push(`static llparse_match_t ${this.getName()}(`);
    out.push(`    ${ctx.prefix}_t* s, const unsigned char* p,`);
    out.push('    const unsigned char* endp,');
    out.push('    const unsigned char* seq, uint32_t seq_len) {');

    // Vars
    out.push('  uint32_t index;');
    out.push('  llparse_match_t res;');
    out.push('');

    // Body
    out.push('  index = s->_index;');
    out.push('  for (; p != endp; p++) {');
    out.push('    unsigned char current;');
    out.push('');
    out.push(`    current = ${this.transform.build(ctx, '*p')};`);
    out.push('    if (current == seq[index]) {');
    out.push('      if (++index == seq_len) {');
    out.push(`        res.status = ${SEQUENCE_COMPLETE};`);
    out.push('        goto reset;');
    out.push('      }');
    out.push('    } else {');
    out.push(`      res.status = ${SEQUENCE_MISMATCH};`);
    out.push('      goto reset;');
    out.push('    }');
    out.push('  }');

    out.push('  s->_index = index;');
    out.push(`  res.status = ${SEQUENCE_PAUSE};`);
    out.push('  res.current = p;');
    out.push('  return res;');

    out.push('reset:');
    out.push('  s->_index = 0;');
    out.push('  res.current = p;');
    out.push('  return res;');
    out.push('}');
  }
}
