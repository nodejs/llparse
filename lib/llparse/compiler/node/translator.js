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

  id(node) {
    let res = node.name;
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
    if (node instanceof llparse.node.Invoke) {
      assert.strictEqual(node[kCases].length, 0);
      res = new compiler.node.Invoke(this.id(node), node[kCode]);
    } else if (node instanceof llparse.node.Error) {
      assert.strictEqual(node[kCases].length, 0);
      res = new compiler.node.Error(this.id(node), node.code, node.reason);
    } else if (node instanceof llparse.node.SpanStart) {
      assert.strictEqual(node[kCases].length, 0);
      res = new compiler.node.SpanStart(this.id(node), node[kSpan]);
    } else if (node instanceof llparse.node.SpanEnd) {
      assert.strictEqual(node[kCases].length, 0);
      res = new compiler.node.SpanEnd(this.id(node), node[kSpan]);
    } else {
      const trie = new llparse.Trie(node.name);

      const combined = trie.combine(node[kCases]);
      if (combined === null) {
        res = new compiler.node.Empty(this.id(node));
      } else {
        list = [];
        res = this.buildTrie(node, combined, list, true);
      }
    }

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
        list = [ res ];
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

    res.children = trie.children.map((child) => {
      const value = child.child.type === 'next' ? child.child.value : null;
      return {
        key: child.key,
        next: this.buildTrie(node, child.child, list),
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

    res.next = this.buildTrie(node, trie.child, list);
    res.value = value;

    list.push(res);
    return res;
  }

  checkSignature(node, value) {
    assert.strictEqual(node[kSignature], value === null ? 'match' : 'value');
  }
}
module.exports = NodeTranslator;
