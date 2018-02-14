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
    start.select({ 'GET': 0, 'POST': 1, 'PUT': 2 }, request);
    start.otherwise(error);

    request.otherwise(parse.invoke('on_request', start));

    const out = parse.build(start);
    console.log(out);
  });
});
