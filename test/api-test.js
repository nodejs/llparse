'use strict';
/* global describe it beforeEach */

const llparse = require('../');

const fixtures = require('./fixtures');

const printMatch = fixtures.printMatch;
const printOff = fixtures.printOff;
const compiledPrint = fixtures.compiledPrint;

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

    const binary = fixtures.build('simple', p.build(start));

    binary('GET', 'off=3 match=1\n', callback);
  });

  it('should optimize shallow select', (callback) => {
    const start = p.node('start');

    start.select({
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
      '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
    }, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = fixtures.build('shallow', p.build(start));

    binary('012', 'off=1 match=0\noff=2 match=1\noff=3 match=2\n', callback);
  });

  it('should support key-value select', (callback) => {
    const start = p.node('start');

    start.select('0', 0, printMatch(p, start));
    start.select('1', 1, printMatch(p, start));
    start.select('2', 2, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = fixtures.build('kv-select', p.build(start));

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

    const binary = fixtures.build('multi-match', p.build(start));
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

    const binary = fixtures.build('multi-match', p.build(start));
    binary(
      'A B  A  A',
      'off=1 match=0\noff=3 match=1\noff=6 match=0\noff=9 match=0\n',
      callback);
  });

  it('should support compiled code', (callback) => {
    const start = p.node('start');

    start.select({
      '0': 0,
      '1': 1
    }, compiledPrint(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = fixtures.build('compiled', p.build(start));
    binary(
      '0110',
      'not one\none\none\nnot one\n',
      callback);
  });

  it('should support custom state properties', (callback) => {
    const start = p.node('start');
    const error = p.error(3, 'Invalid word');

    p.property(ir => ir.i(8), 'custom');

    const second = p.invoke(p.code.load('load', 'custom'), {
      0: p.invoke(p.code.match('print_zero'), { 0: start }, error),
      1: p.invoke(p.code.match('print_one'), { 0: start }, error)
    }, error);

    start
      .select({
        '0': 0,
        '1': 1
      }, p.invoke(p.code.store('store', 'custom'), { 0: second }, error))
      .otherwise(error);

    const binary = fixtures.build('custom-prop', p.build(start));

    binary('0110', 'zero\none\none\nzero\n', callback);
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

      const binary = fixtures.build('otherwise-noadvance', p.build(a));

      binary('AABAB', 'off=3\noff=5\n', callback);
    });

    it('should advance when it is `.skipTo()`', (callback) => {
      const p = llparse.create('llparse');

      const start = p.node('start');

      start
        .match(' ', printOff(p, start))
        .skipTo(start);

      const binary = fixtures.build('otherwise-skip', p.build(start));

      binary('HELLO WORLD', 'off=6\n', callback);
    });

    it('should skip everything with `.skipTo()`', (callback) => {
      const p = llparse.create('llparse');

      const start = p.node('start');

      start
        .skipTo(start);

      const binary = fixtures.build('all-skip', p.build(start));

      binary('HELLO WORLD', '', callback);
    });
  });
});
