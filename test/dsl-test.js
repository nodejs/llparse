'use strict';

const DSL = require('../');

const fixtures = require('./fixtures');

describe('LLParse', () => {
  it('should compile `example.js`', () => {
    const dsl = new DSL(fixtures.source.example);

    dsl.compile();
  });
});
