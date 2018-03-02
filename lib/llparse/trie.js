'use strict';

const assert = require('assert');

class Node {
  constructor(type) {
    this.type = type;
    this.value = null;
  }
}

class Single extends Node {
  constructor() {
    super('single');
    this.children = [];
  }
}

class Sequence extends Node {
  constructor(select) {
    super('sequence');
    this.select = select;
    this.child = null;
  }
}

class Next extends Node {
  constructor(value, next) {
    super('next');
    this.value = value === undefined ? null : value;
    this.next = next;
  }
}

class Trie {
  constructor(name) {
    this.name = name;
  }

  combine(cases) {
    const list = [];
    cases.forEach((one) => {
      one.linearize().forEach(item => list.push(item));
    });

    if (list.length === 0)
      return null;

    return this.level(list, []);
  }

  level(list, path) {
    list.sort((a, b) => {
      return a.key.compare(b.key);
    });

    // TODO(indutny): validate non-empty keys
    const first = list[0].key;
    const last = list[list.length - 1].key;

    let common = 0;
    const min = Math.min(first.length, last.length);

    // Leaf
    if (min === 0) {
      assert.strictEqual(list.length, 1,
        `Duplicate entries in "${this.name}" at [ ${path.join(', ')} ]`);
      return new Next(list[0].value, list[0].next);
    }

    // Find the longest common sub-string
    for (; common < min; common++)
      if (first[common] !== last[common])
        break;

    // Sequence
    if (common > 1)
      return this.sequence(list, first.slice(0, common), path);

    // Single
    return this.single(list, path);
  }

  slice(list, off) {
    return list.map((item) => {
      return {
        key: item.key.slice(off),
        next: item.next,
        value: item.value,
        noAdvance: item.noAdvance
      };
    });
  }

  sequence(list, prefix, path) {
    const res = new Sequence(prefix);

    const sliced = this.slice(list, prefix.length);
    const noAdvance = sliced.some(item => item.noAdvance);
    assert(!noAdvance);
    res.child = this.level(sliced, path.concat(prefix));

    return res;
  }

  single(list, path) {
    const keys = new Map();
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const key = item.key[0];

      if (keys.has(key))
        keys.get(key).push(item);
      else
        keys.set(key, [ item ]);
    }

    const res = new Single();
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
module.exports = Trie;
