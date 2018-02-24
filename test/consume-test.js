'use strict';
/* global describe it beforeEach */

const assert = require('assert');

const llparse = require('../');

const fixtures = require('./fixtures');

const printOff = fixtures.printOff;

describe('LLParse/consume', function() {
  this.timeout(fixtures.TIMEOUT);

  let p;
  beforeEach(() => {
    p = llparse.create('llparse');
  });

  it('should consume bytes', (callback) => {
    p.property('i8', 'to_consume');

    const start = p.node('start');
    const consume = p.consume(p.code.load('to_consume'));

    start.select({
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4
    }, p.invoke(p.code.store('to_consume'), consume));

    start
      .otherwise(p.error(1, 'unexpected'));

    consume
      .otherwise(printOff(p, start));

    const binary = fixtures.build(p, start, 'consume');

    binary('3aaa2bb1a01b', 'off=4\noff=7\noff=9\noff=10\noff=12\n', callback);
  });
});
