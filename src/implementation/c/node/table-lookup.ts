import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import { Node } from './base';

const MAX_CHAR = 0xff;
const TABLE_GROUP = 16;

// _mm_cmpestri takes 8 ranges
const SSE_RANGES_LEN = 16;
// _mm_cmpestri takes 128bit input
const SSE_RANGES_PAD = 16;
const MAX_SSE_CALLS = 2;
const MAX_NEON_RANGES = 6;
const MAX_WASM_RANGES = 6;
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
    if (this.canVectorize()) {
      this.buildSSE(out);
      this.buildNeon(out);
      this.buildWASM(out);
    }

    const current = transform.build(ctx, `*${ctx.posArg()}`);
    out.push(`switch (${table.name}[(uint8_t) ${current}]) {`);

    for (const [ index, edge ] of this.ref.edges.entries()) {
      out.push(`  case ${index + 1}: {`);

      const tmp: string[] = [];
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

  private canVectorize(): boolean {
    // Transformation is not supported atm
    if (this.ref.transform && this.ref.transform.ref.name !== 'id') {
      return false;
    }

    if (this.ref.edges.length !== 1) {
      return false;
    }

    const edge = this.ref.edges[0];
    if (
      !edge ||
      edge.node.ref !== this.ref
    ) {
      return false;
    }

    assert.strictEqual(edge.noAdvance, false);

    return true;
  }

  private buildRanges(edge: frontend.node.TableLookup["edges"][0]): number[] {
    // NOTE: keys are sorted
    const ranges: number[] = [];
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
    return ranges;
  }

  private buildSSE(out: string[]): boolean {
    const ctx = this.compilation;

    const edge = this.ref.edges[0];
    assert(edge !== undefined);

    const ranges = this.buildRanges(edge);

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

  private buildNeon(out: string[]): boolean {
    const ctx = this.compilation;

    const edge = this.ref.edges[0];
    assert(edge !== undefined);

    const ranges = this.buildRanges(edge);

    if (ranges.length === 0) {
      return false;
    }

    // Way too many calls would be required
    if (ranges.length > MAX_NEON_RANGES) {
      return false;
    }

    out.push('#ifdef __ARM_NEON__');
    out.push(`while (${ctx.endPosArg()} - ${ctx.posArg()} >= 16) {`);
    out.push('  uint8x16_t input;');
    out.push('  uint8x16_t single;');
    out.push('  uint8x16_t mask;');
    out.push('  uint8x8_t narrow;');
    out.push('  uint64_t match_mask;');
    out.push('  int match_len;');
    out.push('');
    out.push('  /* Load input */');
    out.push(`  input = vld1q_u8(${ctx.posArg()});`);

    out.push('  /* Find first character that does not match `ranges` */');
    function v128(value: number): string {
      return `vdupq_n_u8(${ctx.toChar(value)})`;
    }

    for (let off = 0; off < ranges.length; off += 2) {
      const start = ranges[off];
      const end = ranges[off + 1];
      assert(start !== undefined);
      assert(end !== undefined);

      // Same character, equality is sufficient (and faster)
      if (start === end) {
        out.push(`  single = vceqq_u8(input, ${v128(start)});`);
      } else {
        out.push(`  single = vandq_u16(`);
        out.push(`    vcgeq_u8(input, ${v128(start)}),`);
        out.push(`    vcleq_u8(input, ${v128(end)})`);
        out.push('  );');
      }

      if (off === 0) {
        out.push('  mask = single;');
      } else {
        out.push('  mask = vorrq_u16(mask, single);');
      }
    }

    // https://community.arm.com/arm-community-blogs/b/servers-and-cloud-computing-blog/posts/porting-x86-vector-bitmask-optimizations-to-arm-neon
    out.push('  narrow = vshrn_n_u16(mask, 4);');
    out.push('  match_mask = ~vget_lane_u64(vreinterpret_u64_u8(narrow), 0);');
    out.push('  match_len = __builtin_ctzll(match_mask) >> 2;');
    out.push('  if (match_len != 16) {');
    out.push(`    ${ctx.posArg()} += match_len;`);
    {
      const tmp: string[] = [];
      this.tailTo(tmp, this.ref.otherwise!);
      ctx.indent(out, tmp, '    ');
    }
    out.push('  }');
    out.push(`  ${ctx.posArg()} += 16;`);
    out.push('}');

    out.push(`if (${ctx.posArg()} == ${ctx.endPosArg()}) {`);
    {
      const tmp: string[] = [];
      this.pause(tmp);
      this.compilation.indent(out, tmp, '  ');
    }
    out.push('}');

    out.push('#endif  /* __ARM_NEON__ */');

    return true;
  }

  private buildWASM(out: string[]): boolean {
    const ctx = this.compilation;

    const edge = this.ref.edges[0];
    assert(edge !== undefined);

    const ranges = this.buildRanges(edge);

    if (ranges.length === 0) {
      return false;
    }

    // Way too many calls would be required
    if (ranges.length > MAX_WASM_RANGES) {
      return false;
    }

    out.push('#ifdef __wasm_simd128__');
    out.push(`while (${ctx.endPosArg()} - ${ctx.posArg()} >= 16) {`);
    out.push('  v128_t input;');
    out.push('  v128_t mask;');
    out.push('  v128_t single;');
    out.push('  int match_len;');
    out.push('');
    out.push('  /* Load input */');
    out.push(`  input = wasm_v128_load(${ctx.posArg()});`);

    out.push('  /* Find first character that does not match `ranges` */');
    function v128(value: number): string {
      return `wasm_u8x16_const_splat(${ctx.toChar(value)})`;
    }

    for (let off = 0; off < ranges.length; off += 2) {
      const start = ranges[off];
      const end = ranges[off + 1];
      assert(start !== undefined);
      assert(end !== undefined);

      // Same character, equality is sufficient (and faster)
      if (start === end) {
        out.push(`  single = wasm_i8x16_eq(input, ${v128(start)});`);
      } else {
        out.push(`  single = wasm_v128_and(`);
        out.push(`    wasm_i8x16_ge(input, ${v128(start)}),`);
        out.push(`    wasm_i8x16_le(input, ${v128(end)})`);
        out.push('  );');
      }

      if (off === 0) {
        out.push('  mask = single;');
      } else {
        out.push('  mask = wasm_v128_or(mask, single);');
      }
    }
    out.push('  match_len = __builtin_ctz(');
    out.push('    ~wasm_i8x16_bitmask(mask)');
    out.push('  );');
    out.push('  if (match_len != 16) {');
    out.push(`    ${ctx.posArg()} += match_len;`);
    {
      const tmp: string[] = [];
      this.tailTo(tmp, this.ref.otherwise!);
      ctx.indent(out, tmp, '    ');
    }
    out.push('  }');
    out.push(`  ${ctx.posArg()} += 16;`);
    out.push('}');

    out.push(`if (${ctx.posArg()} == ${ctx.endPosArg()}) {`);
    {
      const tmp: string[] = [];
      this.pause(tmp);
      this.compilation.indent(out, tmp, '  ');
    }
    out.push('}');

    out.push('#endif  /* __wasm_simd128__ */');

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
