import * as assert from 'assert';

import { LLParse } from '../src/api';

import { build, NUM_SELECT, printMatch, printOff } from './fixtures';

describe('llparse/code', () => {
  let p: LLParse;

  beforeEach(() => {
    p = new LLParse();
  });

  describe('`.mulAdd()`', () => {
    it('should operate normally', async () => {
      const start = p.node('start');
      const dot = p.node('dot');

      p.property('i64', 'counter');

      const is1337 = p.invoke(p.code.load('counter'), {
        1337: printOff(p, p.invoke(p.code.update('counter', 0), start)),
      }, p.error(1, 'Invalid result'));

      const count = p.invoke(p.code.mulAdd('counter', { base: 10 }), start);

      start
        .select(NUM_SELECT, count)
        .otherwise(dot);

      dot
        .match('.', is1337)
        .otherwise(p.error(1, 'Unexpected'));

      const binary = await build(p, start, 'mul-add');
      await binary.check('1337.', 'off=5\n');
    });

    it('should operate fail on overflow', async () => {
      const start = p.node('start');

      p.property('i8', 'counter');

      const count = p.invoke(p.code.mulAdd('counter', { base: 10 }), {
        1: printOff(p, start),
      }, start);

      start
        .select(NUM_SELECT, count)
        .otherwise(p.error(1, 'Unexpected'));

      const binary = await build(p, start, 'mul-add-overflow');
      await binary.check('1111', 'off=4\n');
    });

    it('should operate fail on greater than max', async () => {
      const start = p.node('start');

      p.property('i64', 'counter');

      const count = p.invoke(p.code.mulAdd('counter', {
        base: 10,
        max: 1000,
      }), {
        1: printOff(p, start),
      }, start);

      start
        .select(NUM_SELECT, count)
        .otherwise(p.error(1, 'Unexpected'));

      const binary = await build(p, start, 'mul-add-max-overflow');
      await binary.check('1111', 'off=4\n');
    });
  });

  describe('`.update()`', () => {
    it('should operate normally', async () => {
      const start = p.node('start');

      p.property('i64', 'counter');

      const update = p.invoke(p.code.update('counter', 42));

      start
        .skipTo(update);

      update
        .otherwise(p.invoke(p.code.load('counter'), {
          42: printOff(p, start),
        }, p.error(1, 'Unexpected')));

      const binary = await build(p, start, 'update');
      await binary.check('.', 'off=1\n');
    });
  });

  describe('`.isEqual()`', () => {
    it('should operate normally', async () => {
      const start = p.node('start');

      p.property('i64', 'counter');

      const check = p.invoke(p.code.isEqual('counter', 1), {
        0: printOff(p, start),
        1: start,
      }, p.error(1, 'Unexpected'));

      start
        .select(NUM_SELECT, p.invoke(p.code.store('counter'), check))
        .otherwise(p.error(1, 'Unexpected'));

      const binary = await build(p, start, 'is-equal');
      await binary.check('010', 'off=1\noff=3\n');
    });
  });

  describe('`.or()`/`.and()`/`.test()`', () => {
    it('should set and retrieve bits', async () => {
      const start = p.node('start');
      const test = p.node('test');

      p.property('i64', 'flag');

      start
        .match('1', p.invoke(p.code.or('flag', 1), start))
        .match('2', p.invoke(p.code.or('flag', 2), start))
        .match('4', p.invoke(p.code.or('flag', 4), start))
        // Reset
        .match('r', p.invoke(p.code.update('flag', 0), start))
        // Partial Reset
        .match('p', p.invoke(p.code.and('flag', ~1), start))
        // Test
        .match('-', test)
        .otherwise(p.error(1, 'start'));

      test
        .match('1', p.invoke(p.code.test('flag', 1), {
          0: test,
          1: printOff(p, test),
        }, p.error(2, 'test-1')))
        .match('2', p.invoke(p.code.test('flag', 2), {
          0: test,
          1: printOff(p, test),
        }, p.error(3, 'test-2')))
        .match('4', p.invoke(p.code.test('flag', 4), {
          0: test,
          1: printOff(p, test),
        }, p.error(4, 'test-3')))
        .match('7', p.invoke(p.code.test('flag', 7), {
          0: test,
          1: printOff(p, test),
        }, p.error(5, 'test-7')))
        // Restart
        .match('.', start)
        .otherwise(p.error(6, 'test'));

      const binary = await build(p, start, 'or-test');
      await binary.check('1-124.2-1247.4-1247.r4-124.r12p-12', [
        'off=3',
        'off=9', 'off=10',
        'off=16', 'off=17', 'off=18', 'off=19',
        'off=26',
        'off=34',
      ]);
    });
  });
});
