'use strict';
/* global describe it beforeEach */

const llparse = require('../');

const fixtures = require('./fixtures');

describe('LLParse/transform', function() {
  this.timeout(fixtures.TIMEOUT);

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

    const binary = fixtures.build(p, start, 'transform-lower');

    binary('connectCLOSEcOnNeCt', 'off=7\noff=12\noff=19\n', callback);
  });
});
