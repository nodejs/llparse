'use strict';
/* global describe it beforeEach */

const llparse = require('../');

const fixtures = require('./fixtures');

describe('LLParse/transform', () => {
  let p;
  beforeEach(() => {
    p = llparse.create('llparse');
  });

  it('should apply transformation before the match', (callback) => {
    const start = p.node('start');

    start
      .transform(p.transform.toLowerUnsafe())
      .match('connect', fixtures.printOff(p, start))
      .match('close', fixtures.printOff(p, start))
      .otherwise(p.error(1, 'error'));

    const binary = fixtures.build('transform-lower', p.build(start));

    binary('connectCLOSEcOnNeCt', 'off=7\noff=12\noff=19\n', callback);
  });
});
