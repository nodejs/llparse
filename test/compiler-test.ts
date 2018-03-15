import { Compiler } from '../src/compiler';

describe('llparse/Compiler', () => {
  let c: Compiler;

  beforeEach(() => {
    c = new Compiler({});
  });

  it('should compile sample parser', () => {
    const b = c.createBuilder();

    const start = b.node('start');

    start.match('a', start);
    start.otherwise(b.error(1, 'error'));

    const result = c.compile(start, b.properties);
  });
});