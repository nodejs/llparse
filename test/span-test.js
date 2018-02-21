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
    const body = p.node('body');
    const span = p.span('on_data');

    start.otherwise(span.start().otherwise(body));

    body
      .match([ '0', '1', '2' ], body)
      .otherwise(span.end().otherwise(start));

    const binary = fixtures.build('span', p.build(start));

    binary('012', 'off=3 match=1\n', callback);
  });

  it('should throw on loops', () => {
    const start = p.node('start');
    const span = p.span('on_data');

    start.otherwise(span.start().otherwise(start));

    assert.throws(() => p.build(start), /loop/);
  });
});
