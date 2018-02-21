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
    return this.ctx.prefix + '__n_' + res;
  }

  buildNode(node, value) {
    this.checkSignature(node, value);

    if (this.nodes.has(node))
      return this.nodes.get(node);

    let res;
    if (node instanceof llparse.node.Invoke) {
      assert.strictEqual(node[kCases].length, 0);
      res = new compiler.node.Invoke(this.id(node), node[kCode], node[kMap]);
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

      res = this.buildTrie(node, trie.combine(node[kCases]), true);
    }

    this.nodes.set(node, res);

    if (node instanceof llparse.node.Error) {
      assert.strictEqual(node[kOtherwise], null);
    } else {
      assert.notStrictEqual(node[kOtherwise], null,
        `Node "${node.name}" must have \`.otherwise()\`/\`.skipTo()\``);
      const otherwise = this.buildNode(node[kOtherwise].next, null);
      res.setOtherwise(otherwise, node[kOtherwise].skip);
    }

    return res;
  }

  buildTrie(node, trie, isRoot = false) {
    if (trie.type === 'next') {
      assert(!isRoot);
      return this.buildNode(trie.next, trie.value);
    }

    if (trie.type === 'single')
      return this.buildSingle(node, trie, isRoot);

    assert.strictEqual(trie.type, 'sequence');
    return this.buildSequence(node, trie, isRoot);
  }

  buildSingle(node, trie, isRoot) {
    const res = new compiler.node.Single(this.id(node));

    // Break loops
    if (isRoot)
      this.nodes.set(node, res);

    res.children = trie.children.map((child) => {
      const value = child.child.type === 'next' ? child.child.value : null;
      return { key: child.key, next: this.buildTrie(node, child.child), value };
    });
    return res;
  }

  buildSequence(node, trie, isRoot) {
    const res = new compiler.node.Sequence(this.id(node), trie.select);
    const value = trie.child.type === 'next' ? trie.child.value : null;

    // Break loops
    if (isRoot)
      this.nodes.set(node, res);

    res.next = this.buildTrie(node, trie.child);
    res.value = value;

    return res;
  }

  checkSignature(node, value) {
    assert.strictEqual(node[kSignature], value === null ? 'match' : 'value');
  }
}
module.exports = NodeTranslator;
