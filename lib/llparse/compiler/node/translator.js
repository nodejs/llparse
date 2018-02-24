'use strict';

const assert = require('assert');

const compiler = require('../');
const llparse = require('../../');

const kCases = llparse.symbols.kCases;
const kCode = llparse.symbols.kCode;
const kMap = llparse.symbols.kMap;
const kOtherwise = llparse.symbols.kOtherwise;
const kSignature = llparse.symbols.kSignature;
const kSpan = llparse.symbols.kSpan;
const kTransform = llparse.symbols.kTransform;

class NodeTranslator extends compiler.Stage {
  constructor(ctx) {
    super(ctx, 'node-translator');

    this.nodes = new Map();
    this.namespace = new Set();
  }

  build() {
    // TODO(indutny): detect and report loops

    return this.buildNode(this.ctx.root, null);
  }

  id(node, postfix = '') {
    let res = node.name + postfix;
    if (this.namespace.has(res)) {
      let i;
      for (i = 1; i <= this.namespace.size; i++)
        if (!this.namespace.has(res + '_' + i))
          break;
      res += '_' + i;
    }

    this.namespace.add(res);
    return 'n_' + res;
  }

  buildNode(node, value) {
    this.checkSignature(node, value);

    if (this.nodes.has(node))
      return this.nodes.get(node);

    let res;
    let list;
    let last;
    if (node instanceof llparse.node.Invoke) {
      res = new compiler.node.Invoke(this.id(node), node[kCode]);
    } else if (node instanceof llparse.node.Error) {
      res = new compiler.node.Error(this.id(node), node.code, node.reason);
    } else if (node instanceof llparse.node.SpanStart) {
      res = new compiler.node.SpanStart(this.id(node), node[kSpan][kCode]);
    } else if (node instanceof llparse.node.SpanEnd) {
      res = new compiler.node.SpanEnd(this.id(node), node[kSpan][kCode]);
    } else if (node instanceof llparse.node.Consume) {
      res = this.buildConsume(node);
      last = res.last;
      res = res.first;
    } else {
      assert(node instanceof llparse.node.Match);

      const trie = new llparse.Trie(node.name);

      const combined = trie.combine(node[kCases]);
      if (combined === null) {
        res = new compiler.node.Empty(this.id(node));
      } else {
        list = [];
        res = this.buildTrie(node, combined, list, true);
      }
    }

    if (!last)
      last = res;

    // Prevent loops
    this.nodes.set(node, res);

    // Build `invoke`'s map
    if (node instanceof llparse.node.Invoke) {
      res.map = {};
      Object.keys(node[kMap]).forEach((key) => {
        res.map[key] = this.buildNode(node[kMap][key], null);
      });
    }

    if (node instanceof llparse.node.Error) {
      assert.strictEqual(node[kOtherwise], null);
    } else {
      assert.notStrictEqual(node[kOtherwise], null,
        `Node "${node.name}" must have \`.otherwise()\`/\`.skipTo()\``);

      if (!list)
        list = [ last ];
      const otherwise = this.buildNode(node[kOtherwise].next, null);
      list.forEach((entry) => {
        entry.setOtherwise(otherwise, node[kOtherwise].skip);
      });
    }

    return res;
  }

  buildTrie(node, trie, list, isRoot = false) {
    if (trie.type === 'next') {
      assert(!isRoot);
      return this.buildNode(trie.next, trie.value);
    }

    if (trie.type === 'single')
      return this.buildSingle(node, trie, list, isRoot);

    assert.strictEqual(trie.type, 'sequence');
    return this.buildSequence(node, trie, list, isRoot);
  }

  buildSingle(node, trie, list, isRoot) {
    const res = new compiler.node.Single(this.id(node));

    // Break loops
    if (isRoot)
      this.nodes.set(node, res);

    res.transform = node[kTransform];
    res.children = trie.children.map((child) => {
      const value = child.child.type === 'next' ? child.child.value : null;
      return {
        key: child.key,
        next: this.buildTrie(node, child.child, list),
        noAdvance: child.noAdvance,
        value
      };
    });

    list.push(res);
    return res;
  }

  buildSequence(node, trie, list, isRoot) {
    const res = new compiler.node.Sequence(this.id(node), trie.select);
    const value = trie.child.type === 'next' ? trie.child.value : null;

    // Break loops
    if (isRoot)
      this.nodes.set(node, res);

    res.transform = node[kTransform];
    res.next = this.buildTrie(node, trie.child, list);
    res.value = value;

    list.push(res);
    return res;
  }

  buildConsume(node) {
    const setIndex = new compiler.node.SetIndex(this.id(node, '_set_index'),
      node[kCode]);

    const consume = new compiler.node.Consume(this.id(node, '_consume'));
    setIndex.setOtherwise(consume, false);

    return {
      first: setIndex,
      last: consume
    };
  }

  checkSignature(node, value) {
    assert.strictEqual(node[kSignature], value === null ? 'match' : 'value');
  }
}
module.exports = NodeTranslator;
