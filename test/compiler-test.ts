import { Compiler } from '../src/compiler';

describe('llparse/Compiler', () => {
  let c: Compiler;

  beforeEach(() => {
    c = new Compiler('llparse', {});
  });

  it('should compile sample parser', () => {
    const b = c.createBuilder();

    const start = b.node('start');

    start.match('a', start);
    start.match('b', start);
    start.match('c', start);
    start.match('d', start);
    start.match('e', start);
    start.match('f', start);
    start.match('g', start);
    start.match('h', start);
    start.match('i', start);
    start.match('j', start);
    start.match('k', start);
    start.match('l', start);
    start.match('m', start);
    start.match('n', start);
    start.match('o', start);
    start.match('p', start);
    start.match('q', start);
    start.match('r', start);
    start.match('s', start);
    start.match('t', start);
    start.match('u', start);
    start.match('v', start);
    start.match('w', start);
    start.match('x', start);
    start.match('y', start);
    start.match('z', start);
    start.match('0', start);
    start.match('1', start);
    start.match('2', start);
    start.match('3', start);
    start.match('4', start);
    start.match('5', start);
    start.match('6', start);
    start.match('7', start);
    start.match('8', start);
    start.match('9', start);
    start.otherwise(b.error(1, 'error'));

    const result = c.compile(start, b.properties);

    require('fs').writeFileSync('/tmp/1.bc', result.bitcode);
    require('fs').writeFileSync('/tmp/1.h', result.headers);
  });
});
