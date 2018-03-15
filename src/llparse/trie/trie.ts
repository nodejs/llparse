import * as assert from 'assert';
import { Buffer } from 'buffer';

import { Case, ICaseLinearizeResult } from '../cases';
import { TrieNext } from './next';
import { TrieNode } from './node';
import { TrieSequence } from './sequence';
import { TrieSingle } from './single';

type LinearizeList = ReadonlyArray<ICaseLinearizeResult>;
type Path = ReadonlyArray<number | Buffer>;

export class Trie {
  constructor(private readonly name: string) {
    this.name = name;
  }

  public combine(cases: ReadonlyArray<Case>): TrieNode | undefined {
    const list: ICaseLinearizeResult[] = [];
    cases.forEach((one) => {
      one.linearize().forEach(item => list.push(item));
    });

    if (list.length === 0) {
      return undefined;
    }

    list.sort((a, b) => {
      return a.key.compare(b.key);
    });

    return this.level(list, []);
  }

  private level(list: LinearizeList, path: Path): TrieNode {
    // TODO(indutny): validate non-empty keys
    const first = list[0].key;
    const last = list[list.length - 1].key;

    let common = 0;
    const min = Math.min(first.length, last.length);

    // Leaf
    if (min === 0) {
      assert.strictEqual(list.length, 1,
        `Duplicate entries in "${this.name}" at [ ${path.join(', ')} ]`);
      return new TrieNext(list[0].value, list[0].next);
    }

    // Find the longest common sub-string
    for (; common < min; common++) {
      if (first[common] !== last[common]) {
        break;
      }
    }

    // Sequence
    if (common > 1) {
      return this.sequence(list, first.slice(0, common), path);
    }

    // Single
    return this.single(list, path);
  }

  private slice(list: LinearizeList, off: number): LinearizeList {
    return list.map((item) => {
      return {
        key: item.key.slice(off),
        next: item.next,
        value: item.value,
        noAdvance: item.noAdvance
      };
    });
  }

  private sequence(list: LinearizeList, prefix: Buffer, path: Path)
    : TrieSequence {
    const res = new TrieSequence(prefix);

    const sliced = this.slice(list, prefix.length);
    const noAdvance = sliced.some(item => item.noAdvance);
    assert(!noAdvance);
    res.child = this.level(sliced, path.concat(prefix));

    return res;
  }

  private single(list: LinearizeList, path: Path): TrieSingle {
    const keys: Map<number, ICaseLinearizeResult[]> = new Map();
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const key = item.key[0];

      if (keys.has(key))
        keys.get(key)!.push(item);
      else
        keys.set(key, [ item ]);
    }

    const res = new TrieSingle();
    keys.forEach((sublist, key) => {
      const sliced = this.slice(sublist, 1);
      const subpath = path.concat(key);

      const noAdvance = sublist.some(item => item.noAdvance);
      assert(
        sublist.every(item => item.noAdvance === noAdvance) ||
          sublist.length === 0,
        'Conflicting `.peek()` and `.match()` entries in ' +
          `"${this.name}" at [ ${subpath.join(', ')} ]`);

      res.children.push({
        key,
        noAdvance,
        child: this.level(sliced, subpath)
      });
    });

    return res;
  }
}
