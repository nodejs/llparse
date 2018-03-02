'use strict';
/* global describe it */

const assert = require('assert');

const llparse = require('../lib/llparse/');

describe('LLParse/utils', function() {
  describe('lookup table', () => {
    const enumerate = (table) => {
      const res = new Map();

      for (let c = 0; c < 256; c++) {
        const index = c >>> table.indexShift;
        const shift = (c & table.shiftMask) * table.shiftMul;

        const v = (table.table[index] >>> shift) & table.valueMask;
        if (v === 0)
          continue;

        if (res.has(v - 1))
          res.get(v - 1).push(c);
        else
          res.set(v - 1, [ c ]);
      }

      const sorted = [];
      res.forEach((values, key) => sorted.push({ key, values }));
      return sorted.sort((a, b) => a.key - b.key);
    };

    it('should build correct lookup table width=1', () => {
      const table = llparse.utils.buildLookupTable(5, 8, [
        [ 1, 3, 5, 101, 255 ]
      ]);

      const res = enumerate(table);
      assert.deepStrictEqual(res, [
        { key: 0, values: [ 1, 3, 5, 101, 255 ] }
      ]);
    });

    it('should build correct lookup table width=2', () => {
      const table = llparse.utils.buildLookupTable(5, 8, [
        [ 1, 3, 5, 101, 254 ],
        [ 2, 4, 6, 102, 255 ]
      ]);

      const res = enumerate(table);
      assert.deepStrictEqual(res, [
        { key: 0, values: [ 1, 3, 5, 101, 254 ] },
        { key: 1, values: [ 2, 4, 6, 102, 255 ] }
      ]);
    });

    it('should build correct lookup table width=3', () => {
      const table = llparse.utils.buildLookupTable(5, 8, [
        [ 1, 5, 9, 13, 17, 117 ],
        [ 2, 6, 10, 14, 18, 84 ],
        [ 3, 7, 11, 15, 19, 90 ],
        [ 4, 8, 12, 16, 20, 255 ]
      ]);

      const res = enumerate(table);
      assert.deepStrictEqual(res, [
        { key: 0, values: [ 1, 5, 9, 13, 17, 117 ] },
        { key: 1, values: [ 2, 6, 10, 14, 18, 84 ] },
        { key: 2, values: [ 3, 7, 11, 15, 19, 90 ] },
        { key: 3, values: [ 4, 8, 12, 16, 20, 255 ] }
      ]);
    });
  });
});
