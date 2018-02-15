'use strict';

const llparse = require('../');

describe('LLParse', () => {
  it('should compile simple parser', () => {
    const parse = llparse.create('llparse');

    const start = parse.node('start');
    const request = parse.node('req');
    const response = parse.node('res');
    const error = parse.error(1, 'Invalid word');

    start.match('HTTP', response);
    start.select({ 'HEAD': 0, 'GET': 1, 'POST': 2, 'PUT': 3 }, request);
    start.otherwise(error);

    request.otherwise(parse.invoke('on_request', start));

    const out = parse.build(start);
    console.log(out);
  });
});
