'use strict';

const llparse = require('../');

const fixtures = require('./fixtures');

describe('LLParse', () => {
  it('should compile simple parser', (callback) => {
    const parse = llparse.create('llparse');

    const start = parse.node('start');
    const request = parse.node('req');
    const response = parse.node('res');

    start.match(' ', start);

    start.match('HTTP', parse.invoke('print_match', {
      0: start
    }, parse.error(1, '`on_response` error')));

    start.select({
      'HEAD': 0, 'GET': 1, 'POST': 2, 'PUT': 3,
      'DELETE': 4, 'OPTIONS': 5, 'CONNECT': 6,
      'TRACE': 7, 'PATCH': 8
    }, parse.invoke('print_match', {
      0: start
    }, parse.error(2, '`print_match` error')));

    start.otherwise(parse.error(3, 'Invalid word'));

    const binary = fixtures.build('simple', parse.build(start));

    binary('GET', 'off=3 match=1\n', callback);
  });
});
