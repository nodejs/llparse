import * as assert from 'assert';

import { LLParse } from '../src/api';

import { build, NUM_SELECT, printMatch, printOff } from './fixtures';

describe('llparse/consume', () => {
  let p: LLParse;

  beforeEach(() => {
    p = new LLParse();
  });

  it('should consume bytes with i8 field', async () => {
    p.property('i8', 'to_consume');

    const start = p.node('start');
    const consume = p.consume('to_consume');

    start.select(NUM_SELECT, p.invoke(p.code.store('to_consume'), consume));

    start
      .otherwise(p.error(1, 'unexpected'));

    consume
      .otherwise(printOff(p, start));

    const binary = await build(p, start, 'consume');
    await binary.check('3aaa2bb1a01b', 'off=4\noff=7\noff=9\noff=10\noff=12\n');
  });

  it('should consume bytes with i64 field', async () => {
    p.property('i64', 'to_consume');

    const start = p.node('start');
    const consume = p.consume('to_consume');

    start.select(NUM_SELECT, p.invoke(p.code.store('to_consume'), consume));

    start
      .otherwise(p.error(1, 'unexpected'));

    consume
      .otherwise(printOff(p, start));

    const binary = await build(p, start, 'consume-i64');
    await binary.check('3aaa2bb1a01b', 'off=4\noff=7\noff=9\noff=10\noff=12\n');
  });

  it('should consume bytes with untruncated i64 field', async () => {
    p.property('i64', 'to_consume');

    const start = p.node('start');
    const consume = p.consume('to_consume');

    start
      .select(
        NUM_SELECT,
        p.invoke(p.code.mulAdd('to_consume', { base: 10 }), start)
      )
      .skipTo(consume);

    consume
      .otherwise(printOff(p, start));

    const binary = await build(p, start, 'consume-untruncated-i64');
    await binary.check('4294967297.xxxxxxxx', '\n');
  });
});
