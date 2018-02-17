'use strict';

const assert = require('assert');

class Node {
  constructor(type) {
    this.type = type;
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
  constructor() {
  }

  combine(cases) {
    const list = [];
    cases.forEach((one) => {
      one.linearize().forEach(item => list.push(item));
    });

    if (list.length === 0)
      return null;

    return this.level(list);
  }

  level(list) {
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
      // TODO(indutny): report key, or validate elsewhere
      assert.strictEqual(list.length, 1, 'Duplicate entries');
      return new Next(list[0].value, list[0].next);
    }

    // Find the longest common sub-string
    for (; common < min; common++)
      if (first[common] !== last[common])
        break;

    // Sequence
    if (common > 1)
      return this.sequence(list, first.slice(0, common));

    // Single
    return this.single(list);
  }

  slice(list, off) {
    return list.map((item) => {
      return {
        key: item.key.slice(off),
        next: item.next,
        value: item.value
      };
    });
  }

  sequence(list, prefix) {
    const res = new Sequence(prefix);

    const sliced = this.slice(list, prefix.length);
    res.children = this.level(sliced);

    return res;
  }

  single(list) {
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
      res.children.push({ key, child: this.level(sliced) });
    });

    return res;
  }
}
module.exports = Trie;
