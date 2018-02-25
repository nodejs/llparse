'use strict';
/* global describe it beforeEach */

const llparse = require('../');

const fixtures = require('./fixtures');

const printOff = fixtures.printOff;

describe('LLParse/Code', function() {
  this.timeout(fixtures.TIMEOUT);

  let p;
  beforeEach(() => {
    p = llparse.create('llparse');
  });

  describe('`.mulAdd()`', () => {
    it('should operate normally', (callback) => {
      const start = p.node('start');

      p.property('i64', 'counter');

      const is1337 = p.invoke(p.code.load('counter'), {
        1337: printOff(p, p.invoke(p.code.update('counter', 0), start))
      }, p.error(1, 'Invalid result'));

      const count = p.invoke(p.code.mulAdd('counter', { base: 10 }), start);

      start
        .select(fixtures.NUM, count)
        .match('.', is1337)
        .otherwise(p.error(1, 'Unexpected'));

      const binary = fixtures.build(p, start, 'mul-add');

      binary('1337.', 'off=5\n', callback);
    });

    it('should operate fail on overflow', (callback) => {
      const start = p.node('start');

      p.property('i8', 'counter');

      const count = p.invoke(p.code.mulAdd('counter', { base: 10 }), {
        1: printOff(p, start)
      }, start);

      start
        .select(fixtures.NUM, count)
        .otherwise(p.error(1, 'Unexpected'));

      const binary = fixtures.build(p, start, 'mul-add-overflow');

      binary('1111', 'off=4\n', callback);
    });

    it('should operate fail on greater than max', (callback) => {
      const start = p.node('start');

      p.property('i64', 'counter');

      const count = p.invoke(p.code.mulAdd('counter', {
        base: 10,
        max: 1000
      }), {
        1: printOff(p, start)
      }, start);

      start
        .select(fixtures.NUM, count)
        .otherwise(p.error(1, 'Unexpected'));

      const binary = fixtures.build(p, start, 'mul-add-max-overflow');

      binary('1111', 'off=4\n', callback);
    });
  });

  describe('`.update()`', () => {
    it('should operate normally', (callback) => {
      const start = p.node('start');

      p.property('i64', 'counter');

      const update = p.invoke(p.code.update('counter', 42));

      start
        .skipTo(update);

      update
        .otherwise(p.invoke(p.code.load('counter'), {
          42: printOff(p, start)
        }, p.error(1, 'Unexpected')));

      const binary = fixtures.build(p, start, 'update');

      binary('.', 'off=1\n', callback);
    });
  });
});
