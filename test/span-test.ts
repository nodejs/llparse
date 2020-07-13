import * as assert from 'assert';

import { LLParse } from '../src/api';

import { build, printMatch, printOff } from './fixtures';

describe('llparse/spans', () => {
  let p: LLParse;

  beforeEach(() => {
    p = new LLParse();
  });

  it('should invoke span callback', async () => {
    const start = p.node('start');
    const dot = p.node('dot');
    const dash = p.node('dash');
    const underscore = p.node('underscore');

    const span = {
      dash: p.span(p.code.span('llparse__on_dash')),
      dot: p.span(p.code.span('llparse__on_dot')),
      underscore: p.span(p.code.span('llparse__on_underscore')),
    };

    start.otherwise(span.dot.start(dot));

    dot
      .match('.', dot)
      .peek('-', span.dash.start(dash))
      .peek('_', span.underscore.start(underscore))
      .skipTo(span.dot.end(start));

    dash
      .match('-', dash)
      .otherwise(span.dash.end(dot));

    underscore
      .match('_', underscore)
      .otherwise(span.underscore.end(dot));

    const binary = await build(p, start, 'span');
    await binary.check('..--..__..',
      'off=2 len=2 span[dash]="--"\n' +
      'off=6 len=2 span[underscore]="__"\n' +
      'off=0 len=10 span[dot]="..--..__.."\n');
  });

  it('should return error', async () => {
    const start = p.node('start');
    const dot = p.node('dot');

    const span = {
      pleaseFail: p.span(p.code.span('llparse__please_fail')),
    };

    start.otherwise(span.pleaseFail.start(dot));

    dot
      .match('.', dot)
      .skipTo(span.pleaseFail.end(start));

    const binary = await build(p, start, 'span-error');

    await binary.check(
      '....a',
      /off=\d+ error code=1 reason="please fail"\n/);
  });

  it('should return error at `executeSpans()`', async () => {
    const start = p.node('start');
    const dot = p.node('dot');

    const span = {
      pleaseFail: p.span(p.code.span('llparse__please_fail')),
    };

    start.otherwise(span.pleaseFail.start(dot));

    dot
      .match('.', dot)
      .skipTo(span.pleaseFail.end(start));

    const binary = await build(p, start, 'span-error-execute');

    await binary.check(
      '.........',
      /off=9 error code=1 reason="please fail"\n/, { scan: 100 });
  });

  it('should not invoke spurious span callback', async () => {
    const start = p.node('start');
    const dot = p.node('dot');
    const span = p.span(p.code.span('llparse__on_dot'));

    start
      .match('hello', span.start(dot))
      .skipTo(start);

    dot
      .match('.', dot)
      .skipTo(span.end(start));

    const binary = await build(p, start, 'span-spurious');
    await binary.check('hello', [ '' ]);
  });
});
