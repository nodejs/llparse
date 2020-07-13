import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

const MAX_CHAR = 0xff;
const TABLE_GROUP = 16;

// _mm_cmpestri takes 8 ranges
const SSE_RANGES_LEN = 16;
// _mm_cmpestri takes 128bit input
const SSE_RANGES_PAD = 16;
const MAX_SSE_CALLS = 2;
const SSE_ALIGNMENT = 16;

interface ITable {
  readonly name: string;
  readonly declaration: ReadonlyArray<string>;
}

export class TableLookup extends Node<frontend.node.TableLookup> {
  public doBuild(out: string[]): void {
    const ctx = this.compilation;

    const table = this.buildTable();
    for (const line of table.declaration) {
      out.push(line);
    }

    this.prologue(out);

    const transform = ctx.unwrapTransform(this.ref.transform!);

    // Try to vectorize nodes matching characters and looping to themselves
    // NOTE: `switch` below triggers when there is not enough characters in the
    // stream for vectorized processing.
    this.buildSSE(out);

    const current = transform.build(ctx, `*${ctx.posArg()}`);
    out.push(`switch (${table.name}[(uint8_t) ${current}]) {`);

    for (const [ index, edge ] of this.ref.edges.entries()) {
      out.push(`  case ${index + 1}: {`);

      const tmp: string[] = [];
      const edge = this.ref.edges[index];
      this.tailTo(tmp, {
        noAdvance: edge.noAdvance,
        node: edge.node,
        value: undefined,
      });
      ctx.indent(out, tmp, '    ');

      out.push('  }');
    }

    out.push(`  default: {`);

    const tmp: string[] = [];
    this.tailTo(tmp, this.ref.otherwise!);
    ctx.indent(out, tmp, '    ');

    out.push('  }');
    out.push('}');
  }

  private buildSSE(out: string[]): boolean {
    const ctx = this.compilation;

    // Transformation is not supported atm
    if (this.ref.transform && this.ref.transform.ref.name !== 'id') {
      return false;
    }

    if (this.ref.edges.length !== 1) {
      return false;
    }

    const edge = this.ref.edges[0];
    if (edge.node.ref !== this.ref) {
      return false;
    }

    // NOTE: keys are sorted
    let ranges: number[] = [];
    let first: number | undefined;
    let last: number | undefined;
    for (const key of edge.keys) {
      if (first === undefined) {
        first = key;
      }
      if (last === undefined) {
        last = key;
      }

      if (key - last > 1) {
        ranges.push(first, last);
        first = key;
      }
      last = key;
    }
    if (first !== undefined && last !== undefined) {
      ranges.push(first, last);
    }

    if (ranges.length === 0) {
      return false;
    }

    // Way too many calls would be required
    if (ranges.length > MAX_SSE_CALLS * SSE_RANGES_LEN) {
      return false;
    }

    out.push('#ifdef __SSE4_2__');
    out.push(`if (${ctx.endPosArg()} - ${ctx.posArg()} >= 16) {`);
    out.push('  __m128i ranges;');
    out.push('  __m128i input;');
    out.push('  int avail;');
    out.push('  int match_len;');
    out.push('');
    out.push('  /* Load input */');
    out.push(`  input = _mm_loadu_si128((__m128i const*) ${ctx.posArg()});`);
    for (let off = 0; off < ranges.length; off += SSE_RANGES_LEN) {
      const subRanges = ranges.slice(off, off + SSE_RANGES_LEN);

      let paddedRanges = subRanges.slice();
      while (paddedRanges.length < SSE_RANGES_PAD) {
        paddedRanges.push(0);
      }

      const blob = ctx.blob(Buffer.from(paddedRanges), SSE_ALIGNMENT);
      out.push(`  ranges = _mm_loadu_si128((__m128i const*) ${blob});`);
      out.push('');

      out.push('  /* Find first character that does not match `ranges` */');
      out.push(`  match_len = _mm_cmpestri(ranges, ${subRanges.length},`);
      out.push('      input, 16,');
      out.push('      _SIDD_UBYTE_OPS | _SIDD_CMP_RANGES |');
      out.push('        _SIDD_NEGATIVE_POLARITY);');
      out.push('');
      out.push('  if (match_len != 0) {');
      out.push(`    ${ctx.posArg()} += match_len;`);

      const tmp: string[] = [];
      assert.strictEqual(edge.noAdvance, false);
      this.tailTo(tmp, {
        noAdvance: true,
        node: edge.node,
      });
      ctx.indent(out, tmp, '    ');

      out.push('  }');
    }

    {
      const tmp: string[] = [];
      this.tailTo(tmp, this.ref.otherwise!);
      ctx.indent(out, tmp, '  ');
    }
    out.push('}');

    out.push('#endif  /* __SSE4_2__ */');

    return true;
  }

  private buildTable(): ITable {
    const table: number[] = new Array(MAX_CHAR + 1).fill(0);

    for (const [ index, edge ] of this.ref.edges.entries()) {
      edge.keys.forEach((key) => {
        assert.strictEqual(table[key], 0);
        table[key] = index + 1;
      });
    }

    const lines = [
      'static uint8_t lookup_table[] = {',
    ];
    for (let i = 0; i < table.length; i += TABLE_GROUP) {
      let line = `  ${table.slice(i, i + TABLE_GROUP).join(', ')}`;
      if (i + TABLE_GROUP < table.length) {
        line += ',';
      }
      lines.push(line);
    }
    lines.push('};');

    return {
      name: 'lookup_table',
      declaration: lines,
    };
  }
}
