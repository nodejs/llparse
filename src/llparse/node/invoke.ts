import * as assert from 'assert';

import { Code } from '../code';
import { Node } from './node';

export class Invoke extends Node {
  public readonly map: ReadonlyMap<number, Node>;

  constructor(public readonly code: Code,
              map: { [key: number]: Node }, otherwise?: Node) {
    super('invoke_' + code.name, code.signature);

    const storedMap: Map<number, Node> = new Map();
    Object.keys(map).forEach((key) => {
      assert.strictEqual(key, key | 0,
        'Only integer keys are allowed in `.invoke()`\'s map');

      storedMap.set(key, map[key]!);
    });
    this.map = storedMap;

    if (otherwise !== undefined)
      this.otherwise(otherwise);
  }
}
