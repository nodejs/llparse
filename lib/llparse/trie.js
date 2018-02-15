'use strict';

class Single {
  constructor(value) {
    this.type = 'single';
    this.value = value;
  }
}

class Multiple {
  constructor(value) {
    this.type = 'multiple';
    this.value = value;
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

    list.sort((a, b) => {
      return a.key.compare(b.key);
    });

    const tree = new Map();

    return tree;
  }
}
module.exports = Trie;
