'use strict';
/* global describe it beforeEach */

const assert = require('assert');

const llparse = require('../');

const fixtures = require('./fixtures');

describe('LLParse/node-loop-checker', function() {
  this.timeout(fixtures.TIMEOUT);

  let p;
  beforeEach(() => {
    p = llparse.create('llparse');
  });

  it('should detect loops', () => {
    const start = p.node('start');
    const a = p.node('a');
    const invoke = p.invoke(p.code.match('nop'), {
      0: start
    }, p.error(1, 'error'));

    start
      .peek('a', a)
      .otherwise(p.error(1, 'error'));

    a.otherwise(invoke);

    assert.throws(() => {
      p.build(start);
    }, /detected in "start".*"invoke_nop"/);
  });

  it('should ignore loops through `peek` to `match`', () => {
    const start = p.node('start');
    const a = p.node('a');
    const invoke = p.invoke(p.code.match('nop'), {
      0: start
    }, p.error(1, 'error'));

    start
      .peek('a', a)
      .otherwise(p.error(1, 'error'));

    a
      .match('a', invoke)
      .otherwise(start);

    assert.doesNotThrow(() => p.build(start));
  });
});
