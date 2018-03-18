import { builder, Builder, Compiler } from '../src/compiler';

import { build, printMatch, printOff } from './fixtures';

describe('llparse/Compiler', () => {
  let c: Compiler;
  let p: Builder;

  beforeEach(() => {
    c = new Compiler();
    p = c.createBuilder();
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

    const binary = build(c.compile(start, p.properties), 'simple');
    await binary.check('GET', 'off=3 match=1\n');
  });
});
