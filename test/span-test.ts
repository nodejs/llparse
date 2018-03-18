import { builder, Builder, Compiler } from '../src/compiler';

import { build, printMatch, printOff } from './fixtures';

describe('llparse/Compiler', () => {
  let c: Compiler;
  let p: Builder;

  beforeEach(() => {
    c = new Compiler();
    p = c.createBuilder();
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

    const binary = build(c.compile(start, p.properties), 'span');
    await binary.check('..--..__..',
      'off=2 len=2 span[dash]="--"\n' +
      'off=6 len=2 span[underscore]="__"\n' +
      'off=0 len=10 span[dot]="..--..__.."\n');
  });
});
