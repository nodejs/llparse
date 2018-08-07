import * as assert from 'assert';
import { Buffer } from 'buffer';
import * as frontend from 'llparse-frontend';

import {
  SEQUENCE_COMPLETE, SEQUENCE_MISMATCH, SEQUENCE_PAUSE,
} from '../constants';
import { Transform } from '../transform';

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
    out.push('typedef enum llparse_match_status_e llparse_match_status_t');
    out.push('');
    out.push('struct llparse_match_s {');
    out.push('  llparse_match_status_t status;');
    out.push('  const unsigned char* current;');
    out.push('};');
    out.push('typedef struct llparse_match_s llparse_match_t');
  }

  public getName(): string {
    return 'match_sequence';
  }

  public build(out: string[]): void {
  }
}
