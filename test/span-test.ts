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

    const binary = build(p, start, 'span');
    await binary.check('..--..__..',
      'off=2 len=2 span[dash]="--"\n' +
      'off=6 len=2 span[underscore]="__"\n' +
      'off=0 len=10 span[dot]="..--..__.."\n');
  });

  it('should throw on loops', () => {
    const start = p.node('start');
    const span = p.span(p.code.span('llparse__on_data'));

    start.otherwise(span.start().skipTo(start));

    assert.throws(() => p.build(start), /loop.*on_data/);
  });

  it('should throw on unmatched ends', () => {
    const start = p.node('start');
    const span = p.span(p.code.span('llparse__on_data'));

    start.otherwise(span.end().skipTo(start));

    assert.throws(() => p.build(start), /unmatched.*on_data/i);
  });

  it('should throw on branched unmatched ends', () => {
    const start = p.node('start');
    const end = p.node('end');
    const span = p.span(p.code.span('llparse__on_data'));

    start
      .match('a', end)
      .match('b', span.start(end))
      .otherwise(p.error(1, 'error'));

    end
      .otherwise(span.end(start));

    assert.throws(() => p.build(start), /unmatched.*on_data/i);
  });

  it('should propagate through the Invoke map', () => {
    const start = p.node('start');
    const span = p.span(p.code.span('llparse__on_data'));

    p.property('i8', 'custom');

    start.otherwise(p.invoke(p.code.load('custom'), {
      0: span.end().skipTo(start),
    }, span.end().skipTo(start)));

    assert.doesNotThrow(() => p.build(span.start(start)));
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

    const binary = build(p, start, 'span-error');

    await binary.check(
      '....a',
      /off=\d+ error code=1 reason="Span callback error"\n/);
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

    const binary = build(p, start, 'span-spurious');
    await binary.check('hello', [ '' ]);
  });
});
