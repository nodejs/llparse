'use strict';

const DSL = require('../');

const fixtures = require('./fixtures');

describe('LLParse', () => {
  it('should compile `example.js`', () => {
    const dsl = new DSL('llparse', fixtures.source.example);

    const out = dsl.compile();
    console.log(out);
  });
});
