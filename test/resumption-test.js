'use strict';
/* global describe it beforeEach */

const llparse = require('../');

const fixtures = require('./fixtures');

describe('LLParse/resumption', function() {
  this.timeout(fixtures.TIMEOUT);

  let p;
  beforeEach(() => {
    p = llparse.create('llparse');
  });

  it('should resume after error', (callback) => {
    const start = p.node('start');

    start
      .match('a', start)
      .skipTo(p.error(fixtures.ERROR_PAUSE, 'pause'));

    const binary = fixtures.build(p, start, 'resume-error');

    binary('abab', 'off=2 pause\noff=4 pause\n', callback);
  });

  it('should resume after span end pause', (callback) => {
    const start = p.node('start');
    const a = p.node('a');
    const span = p.span(p.code.span('llparse__pause_once'));

    start
      .peek('a', span.start(a))
      .skipTo(start);

    a
      .match('a', a)
      .otherwise(span.end(start));

    const binary = fixtures.build(p, start, 'resume-span');

    binary('baaab',
      new RegExp(
        '^('+
          'off=\\d+ pause\\noff=1 len=3 span\\[pause\\]="aaa"' +
          '|' +
          'off=1 len=3 span\\[pause\\]="aaa"\noff=4 pause' +
          ')\\n$'
        , 'g'),
      callback);
  });
});
