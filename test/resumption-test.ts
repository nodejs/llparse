import * as assert from 'assert';

import { LLParse } from '../src/api';

import { build, ERROR_PAUSE, printMatch, printOff } from './fixtures';

describe('llparse/resumption', () => {
  let p: LLParse;

  beforeEach(() => {
    p = new LLParse();
  });

  it('should resume after span end pause', async () => {
    const start = p.node('start');
    const a = p.node('a');
    const span = p.span(p.code.span('llparse__pause_once'));

    start
      .peek('a', span.start(a))
      .skipTo(start);

    a
      .match('a', a)
      .otherwise(span.end(start));

    const binary = await build(p, start, 'resume-span');

    await binary.check('baaab',
      new RegExp(
        '^(' +
          'off=\\d+ pause\\noff=1 len=3 span\\[pause\\]="aaa"' +
          '|' +
          'off=1 len=3 span\\[pause\\]="aaa"\noff=4 pause' +
          ')\\n$'
        , 'g'));
  });

  it('should resume after `pause` node', async () => {
    const start = p.node('start');
    const pause = p.pause(ERROR_PAUSE, 'paused');

    start
      .match('p', pause)
      .skipTo(start);

    pause
      .otherwise(printOff(p, start));

    const binary = await build(p, start, 'resume-pause');

    await binary.check('..p....p..',
      'off=3 pause\noff=3\noff=8 pause\noff=8\n');
  });
});
