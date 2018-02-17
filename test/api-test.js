'use strict';

const llparse = require('../');

describe('LLParse', () => {
  it('should compile simple parser', () => {
    const parse = llparse.create('llparse');

    const start = parse.node('start');
    const request = parse.node('req');
    const response = parse.node('res');
    const error = parse.error(1, 'Invalid word');

    start.match('HTTP', parse.invoke('on_response', {
      0: start
    }, parse.error(2, '`on_response` error')));

    start.otherwise(error);

    const out = parse.build(start);
    require('fs').writeFileSync('./2.ll', out);
  });
});
