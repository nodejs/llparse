'use strict';
/* global describe it beforeEach */

const llparse = require('../');

const fixtures = require('./fixtures');

const printOff = fixtures.printOff;
const printMatch = fixtures.printMatch;

describe('LLParse', () => {
  let p;
  beforeEach(() => {
    p = llparse.create('llparse');
  });

  it('should compile simple parser', (callback) => {
    const start = p.node('start');

    start.match(' ', start);

    start.match('HTTP', printOff(p, start));

    start.select({
      'HEAD': 0, 'GET': 1, 'POST': 2, 'PUT': 3,
      'DELETE': 4, 'OPTIONS': 5, 'CONNECT': 6,
      'TRACE': 7, 'PATCH': 8
    }, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = fixtures.build(p, start, 'simple');

    binary('GET', 'off=3 match=1\n', callback);
  });

  it('should optimize shallow select', (callback) => {
    const start = p.node('start');

    start.select({
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
      '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
    }, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = fixtures.build(p, start, 'shallow');

    binary('012', 'off=1 match=0\noff=2 match=1\noff=3 match=2\n', callback);
  });

  it('should support key-value select', (callback) => {
    const start = p.node('start');

    start.select('0', 0, printMatch(p, start));
    start.select('1', 1, printMatch(p, start));
    start.select('2', 2, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = fixtures.build(p, start, 'kv-select');

    binary('012', 'off=1 match=0\noff=2 match=1\noff=3 match=2\n', callback);
  });

  it('should support multi-match', (callback) => {
    const start = p.node('start');

    start.match([ ' ', '\t', '\r', '\n' ], start);

    start.select({
      'A': 0,
      'B': 1
    }, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = fixtures.build(p, start, 'multi-match');
    binary(
      'A B\t\tA\r\nA',
      'off=1 match=0\noff=3 match=1\noff=6 match=0\noff=9 match=0\n',
      callback);
  });

  it('should support numeric-match', (callback) => {
    const start = p.node('start');

    start.match(32, start);

    start.select({
      'A': 0,
      'B': 1
    }, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = fixtures.build(p, start, 'multi-match');
    binary(
      'A B  A  A',
      'off=1 match=0\noff=3 match=1\noff=6 match=0\noff=9 match=0\n',
      callback);
  });

  it('should support custom state properties', (callback) => {
    const start = p.node('start');
    const error = p.error(3, 'Invalid word');

    p.property('i8', 'custom');

    const second = p.invoke(p.code.load('custom'), {
      0: p.invoke(p.code.match('llparse__print_zero'), { 0: start }, error),
      1: p.invoke(p.code.match('llparse__print_one'), { 0: start }, error)
    }, error);

    start
      .select({
        '0': 0,
        '1': 1
      }, p.invoke(p.code.store('custom'), second))
      .otherwise(error);

    const binary = fixtures.build(p, start, 'custom-prop');

    binary('0110', 'off=1 0\noff=2 1\noff=3 1\noff=4 0\n', callback);
  });

  describe('`.peek()`', () => {
    it('should not advance position', (callback) => {
      const start = p.node('start');
      const ab = p.node('ab');
      const error = p.error(3, 'Invalid word');

      start
        .peek([ 'a', 'b' ], ab)
        .otherwise(error);

      ab
        .match([ 'a', 'b' ], printOff(p, start))
        .otherwise(error);

      const binary = fixtures.build(p, start, 'peek');

      binary('ab', 'off=1\noff=2\n', callback);
    });
  });

  describe('`.otherwise()`', () => {
    it('should not advance position by default', (callback) => {
      const p = llparse.create('llparse');

      const a = p.node('a');
      const b = p.node('b');

      a
        .match('A', a)
        .otherwise(b);

      b
        .match('B', printOff(p, b))
        .otherwise(a);

      const binary = fixtures.build(p, a, 'otherwise-noadvance');

      binary('AABAB', 'off=3\noff=5\n', callback);
    });

    it('should advance when it is `.skipTo()`', (callback) => {
      const p = llparse.create('llparse');

      const start = p.node('start');

      start
        .match(' ', printOff(p, start))
        .skipTo(start);

      const binary = fixtures.build(p, start, 'otherwise-skip');

      binary('HELLO WORLD', 'off=6\n', callback);
    });

    it('should skip everything with `.skipTo()`', (callback) => {
      const p = llparse.create('llparse');

      const start = p.node('start');

      start
        .skipTo(start);

      const binary = fixtures.build(p, start, 'all-skip');

      binary('HELLO WORLD', '\n', callback);
    });
  });
});
