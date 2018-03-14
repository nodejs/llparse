import * as assert from 'assert';
import { Buffer } from 'buffer';

import { Node } from './node';

export function toBuffer(value: number | string): Buffer {
  if (typeof value === 'number') {
    assert(0 <= value <= 255, 'Invalid char value, must be between 0 and 255');
    assert.strictEqual(value, value | 0, 'Invalid char value, must be integer');
    return Buffer.from([ value ]);
  } else {
    return Buffer.from(value);
  }
}

export function powerOfTwo(num: number): number {
  return Math.pow(2, Math.ceil(Math.log2(num)));
}

export interface ILookupListEntry {
  node: Node;
  noAdvance: boolean;
  keys: ReadonlyArray<number>;
}

export interface ILookupResult {
  indexShift: number;
  shiftMask: number;
  shiftMul: number;
  table: ReadonlyArray<number>;
  valueMask: number;
}

export function buildLookupTable(wordWidth: number, charWidth: number,
  list: Readonly<ILookupListEntry>): ILookupTableResult {
  // Entry values:
  //   0 - no hit
  //   1 - map[0]
  //   ...
  //   n - map[n]
  const width = exports.powerOfTwo(Math.ceil(Math.log2(list.length + 1)));
  assert(width >= 1);

  assert(charWidth + width - wordWidth > 0);

  // TODO(indutny): 64-bit table through BN support?
  const indexShift = wordWidth - Math.log2(width);
  const table = new Array(1 << (charWidth - indexShift)).fill(0);

  assert(indexShift > 0);

  const shiftMask = (1 << indexShift) - 1;
  const shiftMul = width;

  list.forEach((entry, i) => {
    const val = i + 1;

    entry.forEach((key) => {
      const index = key >> indexShift;
      const shift = (key & shiftMask) * shiftMul;

      table[index] |= val << shift;
    });
  });

  return {
    table,
    indexShift,
    shiftMask,
    shiftMul,
    valueMask: (1 << width) - 1
  };
}
