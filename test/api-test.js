'use strict';
/* global describe it beforeEach */

const llparse = require('../');

const fixtures = require('./fixtures');

describe('LLParse', () => {
  let p;
  beforeEach(() => {
    p = llparse.create('llparse');
  });

  const printMatch = (next) => {
    return p.invoke('print_match', {
      0: next
    }, p.error(1, '`print_match` error'));
  };

  it('should compile simple parser', (callback) => {
    const start = p.node('start');

    start.match(' ', start);

    start.match('HTTP', printMatch(start));

    start.select({
      'HEAD': 0, 'GET': 1, 'POST': 2, 'PUT': 3,
      'DELETE': 4, 'OPTIONS': 5, 'CONNECT': 6,
      'TRACE': 7, 'PATCH': 8
    }, printMatch(start));

    start.otherwise(p.error(3, 'Invalid word'));

    const binary = fixtures.build('simple', p.build(start));

    binary('GET', 'off=3 match=1\n', callback);
  });

  describe('`.otherwise()`', () => {
    it('should not advance position', (callback) => {
      const p = llparse.create('llparse');

      const a = p.node('a');
      const b = p.node('b');

      a
        .match('A', a)
        .otherwise(b);

      b
        .match('B', printMatch(b))
        .otherwise(a);


      const binary = fixtures.build('otherwise-noadvance', p.build(a));

      binary('AABAB', 'off=3 match=0\noff=5 match=0\n', callback);
    });

    it('should advance when it is `.skip()`', (callback) => {
      const p = llparse.create('llparse');

      const start = p.node('start');

      start
        .match(' ', printMatch(start))
        .otherwise(p.skip());

      const binary = fixtures.build('otherwise-skip', p.build(start));

      binary('HELLO WORLD', 'off=6 match=0\n', callback);
    });
  });
});
