import * as assert from 'assert';

import { LLParse } from '../src/api';

import { build, printMatch, printOff } from './fixtures';

describe('llparse/transform', () => {
  let p: LLParse;

  beforeEach(() => {
    p = new LLParse();
  });

  it('should apply transformation before the match', async () => {
    const start = p.node('start');

    start
      .transform(p.transform.toLowerUnsafe())
      .match('connect', printOff(p, start))
      .match('close', printOff(p, start))
      .otherwise(p.error(1, 'error'));

    const binary = await build(p, start, 'transform-lower');
    await binary.check('connectCLOSEcOnNeCt', 'off=7\noff=12\noff=19\n');
  });

  it('should apply safe `toLower()` transformation', async () => {
    const start = p.node('start');

    start
      .transform(p.transform.toLower())
      .select({
        'a-b': 1,
        'a\rb': 2,
      }, printMatch(p, start))
      .otherwise(p.error(1, 'error'));

    const binary = await build(p, start, 'transform-safe-lower');
    await binary.check('A-ba\rB', 'off=3 match=1\noff=6 match=2\n');
  });
});
