'use strict';
/* global describe it beforeEach */

const assert = require('assert');

const llparse = require('../');

const fixtures = require('./fixtures');

describe('LLParse/span', () => {
  let p;
  beforeEach(() => {
    p = llparse.create('llparse');
  });

  it('should invoke span callback', (callback) => {
    const start = p.node('start');
    const dot = p.node('dot');
    const dash = p.node('dash');
    const span = {
      dot: p.span('on_dot'),
      dash: p.span('on_dash')
    };

    start.otherwise(span.dot.start(dot));

    dot
      .match('.', dot)
      .match('-', span.dash.start(dash))
      .skipTo(span.dot.end(start));

    dash
      .match('-', dash)
      .otherwise(span.dash.end(dot));

    const binary = fixtures.build('span', p.build(start));

    binary('012', 'off=3 match=1\n', callback);
  });

  it('should throw on loops', () => {
    const start = p.node('start');
    const span = p.span('on_data');

    start.otherwise(span.start().otherwise(start));

    assert.throws(() => p.build(start), /loop/);
  });

  it('should throw on unmatched ends', () => {
    const start = p.node('start');
    const span = p.span('on_data');

    start.otherwise(span.end().otherwise(start));

    assert.throws(() => p.build(start), /unmatched/i);
  });
});
