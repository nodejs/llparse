import { Fixture } from 'llparse-test-fixture';
import * as path from 'path';
import { builder, Builder, ICompilerResult } from '../../src/compiler';

import node = builder.node;

export { ERROR_PAUSE } from 'llparse-test-fixture';

const fixtures = new Fixture({
  buildDir: path.join(__dirname, '..', 'tmp'),
  extra: [ path.join(__dirname, 'extra.c') ],
});

export function build(artifacts: ICompilerResult, name: string): any {
  return fixtures.build(artifacts, name);
}

export function printMatch(p: Builder, next: node.Node): node.Node {
  const code = p.code.value('llparse__print_match');
  const res = p.invoke(code, next);
  return res;
}

export function printOff(p: Builder, next: node.Node): node.Node {
  const code = p.code.match('llparse__print_off');
  return p.invoke(code, next);
}

export const NUM_SELECT: { readonly [key: string]: number } = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
};

export const NUM: ReadonlyArray<string> = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];

export const ALPHA: ReadonlyArray<string> = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
  'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];
