import { source } from 'llparse-frontend';
import { Fixture, FixtureResult } from 'llparse-test-fixture';
import * as path from 'path';

import { LLParse } from '../../src/api';

export { ERROR_PAUSE } from 'llparse-test-fixture';

const fixtures = new Fixture({
  buildDir: path.join(__dirname, '..', 'tmp'),
  extra: [
    '-msse4.2',
    '-DLLPARSE__TEST_INIT=llparse__test_init',
    path.join(__dirname, 'extra.c'),
  ],
});

export function build(llparse: LLParse, node: source.node.Node, outFile: string)
  : Promise<FixtureResult> {
  return fixtures.build(llparse.build(node, {
    c: {
      header: outFile,
    },
  }), outFile);
}

export function printMatch(p: LLParse, next: source.node.Node)
  : source.node.Node {
  const code = p.code.value('llparse__print_match');
  const res = p.invoke(code, next);
  return res;
}

export function printOff(p: LLParse, next: source.node.Node): source.node.Node {
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
