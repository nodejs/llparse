import { Compiler } from '../src/compiler';

describe('llparse/Compiler', () => {
  let c: Compiler;

  beforeEach(() => {
    c = new Compiler('llparse', {});
  });

  it('should compile sample parser', () => {
    const b = c.createBuilder();

    const start = b.node('start');

    start.match('aadvark', start);
    start.match('b', start);
    start.match('c', start);
    start.otherwise(b.error(1, 'error'));

    const result = c.compile(start, b.properties);
  });
});
