import { LLParse } from '../src/api';

import {
  ALPHA, build, NUM, NUM_SELECT, printMatch, printOff,
} from './fixtures';

describe('llparse/Compiler', () => {
  let p: LLParse;

  beforeEach(() => {
    p = new LLParse();
  });

  it('should compile simple parser', async () => {
    const start = p.node('start');

    start.match(' ', start);

    start.match('HTTP', printOff(p, start));

    start.select({
      CONNECT: 6,
      DELETE: 4,
      GET: 1,
      HEAD: 0,
      OPTIONS: 5,
      PATCH: 8,
      POST: 2,
      PUT: 3,
      TRACE: 7,
    }, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = await build(p, start, 'simple');
    await binary.check('GET', 'off=3 match=1\n');
  });

  it('should optimize shallow select', async () => {
    const start = p.node('start');

    start.select(NUM_SELECT, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = await build(p, start, 'shallow');
    await binary.check('012', 'off=1 match=0\noff=2 match=1\noff=3 match=2\n');
  });

  it('should support key-value select', async () => {
    const start = p.node('start');

    start.select('0', 0, printMatch(p, start));
    start.select('1', 1, printMatch(p, start));
    start.select('2', 2, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = await build(p, start, 'kv-select');
    await binary.check('012', 'off=1 match=0\noff=2 match=1\noff=3 match=2\n');
  });

  it('should support multi-match', async () => {
    const start = p.node('start');

    start.match([ ' ', '\t', '\r', '\n' ], start);

    start.select({
      A: 0,
      B: 1,
    }, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = await build(p, start, 'multi-match');
    await binary.check(
      'A B\t\tA\r\nA',
      'off=1 match=0\noff=3 match=1\noff=6 match=0\noff=9 match=0\n');
  });

  it('should support numeric-match', async () => {
    const start = p.node('start');

    start.match(32, start);

    start.select({
      A: 0,
      B: 1,
    }, printMatch(p, start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = await build(p, start, 'multi-match');
    await binary.check(
      'A B  A  A',
      'off=1 match=0\noff=3 match=1\noff=6 match=0\noff=9 match=0\n');
  });

  it('should support custom state properties', async () => {
    const start = p.node('start');
    const error = p.error(3, 'Invalid word');

    p.property('i8', 'custom');

    const second = p.invoke(p.code.load('custom'), {
      0: p.invoke(p.code.match('llparse__print_zero'), { 0: start }, error),
      1: p.invoke(p.code.match('llparse__print_one'), { 0: start }, error),
    }, error);

    start
      .select({
        0: 0,
        1: 1,
      }, p.invoke(p.code.store('custom'), second))
      .otherwise(error);

    const binary = await build(p, start, 'custom-prop');
    await binary.check('0110', 'off=1 0\noff=2 1\noff=3 1\noff=4 0\n');
  });

  it('should return error code/reason', async () => {
    const start = p.node('start');

    start.match('a', start);
    start.otherwise(p.error(42, 'some reason'));

    const binary = await build(p, start, 'error');
    await binary.check('aab', 'off=2 error code=42 reason="some reason"\n');
  });

  it('should not merge `.match()` with `.peek()`', async () => {
    const maybeCr = p.node('maybeCr');
    const lf = p.node('lf');

    maybeCr.peek('\n', lf);
    maybeCr.match('\r', lf);
    maybeCr.otherwise(p.error(1, 'error'));

    lf.match('\n', printOff(p, maybeCr));
    lf.otherwise(p.error(2, 'error'));

    const binary = await build(p, maybeCr, 'no-merge');
    await binary.check('\r\n\n', 'off=2\noff=3\n');
  });

  describe('`.match()`', () => {
    it('should compile to a single-bit table-lookup node', async () => {
      const start = p.node('start');

      start
        .match(ALPHA, start)
        .skipTo(printOff(p, start));

      // TODO(indutny): validate compilation result?
      const binary = await build(p, start, 'match-bit-check');
      await binary.check('pecan.is.dead.', 'off=6\noff=9\noff=14\n');
    });

    it('should compile to a multi-bit table-lookup node', async () => {
      const start = p.node('start');
      const another = p.node('another');

      start
        .match(ALPHA, start)
        .peek(NUM, another)
        .skipTo(printOff(p, start));

      another
        .match(NUM, another)
        .otherwise(start);

      // TODO(indutny): validate compilation result?
      const binary = await build(p, start, 'match-multi-bit-check');
      await binary.check('pecan.135.is.dead.',
        'off=6\noff=10\noff=13\noff=18\n');
    });

    it('should not overflow on signed char in table-lookup node', async () => {
      const start = p.node('start');

      start
        .match(ALPHA, start)
        .match([ 0xc3, 0xbc ], start)
        .skipTo(printOff(p, start));

      // TODO(indutny): validate compilation result?
      const binary = await build(p, start, 'match-bit-check');
      await binary.check('Düsseldorf.', 'off=12\n');
    });

    it('should match single quotes and forward slashes', async () => {
      const start = p.node('start');

      start
        .match('\'', printOff(p, start))
        .match('\\', printOff(p, start))
        .otherwise(p.error(3, 'Invalid char'));

      // TODO(indutny): validate compilation result?
      const binary = await build(p, start, 'escape-char');
      await binary.check('\\\'', 'off=1\noff=2\n');
    });

    it('should hit SSE4.2 optimization for table-lookup', async () => {
      const start = p.node('start');

      start
        .match(ALPHA, start)
        .skipTo(printOff(p, start));

      // TODO(indutny): validate compilation result?
      const binary = await build(p, start, 'match-bit-check-sse');
      await binary.check('abcdabcdabcdabcdabcdabcdabcd.abcd.',
        'off=29\noff=34\n');
    });

    it('should compile overlapping matches', async () => {
      const start = p.node('start');

      start.select({
        aa: 1,
        aab: 2,
      }, printMatch(p, start));

      start.otherwise(p.error(3, 'Invalid word'));

      const binary = await build(p, start, 'overlapping-matches');
      await binary.check('aaaabaa', 'off=2 match=1\noff=5 match=2\n');
    });
  });

  describe('`.peek()`', () => {
    it('should not advance position', async () => {
      const start = p.node('start');
      const ab = p.node('ab');
      const error = p.error(3, 'Invalid word');

      start
        .peek([ 'a', 'b' ], ab)
        .otherwise(error);

      ab
        .match([ 'a', 'b' ], printOff(p, start))
        .otherwise(error);

      const binary = await build(p, start, 'peek');
      await binary.check('ab', 'off=1\noff=2\n');
    });
  });

  describe('`.otherwise()`', () => {
    it('should not advance position by default', async () => {
      const a = p.node('a');
      const b = p.node('b');

      a
        .match('A', a)
        .otherwise(b);

      b
        .match('B', printOff(p, b))
        .skipTo(a);

      const binary = await build(p, a, 'otherwise-noadvance');
      await binary.check('AABAB', 'off=3\noff=5\n');
    });

    it('should advance when it is `.skipTo()`', async () => {
      const start = p.node('start');

      start
        .match(' ', printOff(p, start))
        .skipTo(start);

      const binary = await build(p, start, 'otherwise-skip');
      await binary.check('HELLO WORLD', 'off=6\n');
    });

    it('should skip everything with `.skipTo()`', async () => {
      const start = p.node('start');

      start
        .skipTo(start);

      const binary = await build(p, start, 'all-skip');
      await binary.check('HELLO WORLD', '\n');
    });
  });
});
