'use strict';

const assert = require('assert');
const debugOpt = require('debug')('llparse:opt');

const Stage = require('./').Stage;
const compiler = require('../');
const llparse = require('../../');

const kCases = llparse.symbols.kCases;
const kCode = llparse.symbols.kCode;
const kMap = llparse.symbols.kMap;
const kOtherwise = llparse.symbols.kOtherwise;
const kSignature = llparse.symbols.kSignature;
const kSpan = llparse.symbols.kSpan;
const kTransform = llparse.symbols.kTransform;

class NodeTranslator extends Stage {
  constructor(ctx) {
    super(ctx, 'node-translator');

    this.options = Object.assign({
      // Minimum number of cases of `single` node to make it eligable for
      // `BitCheck` optimization
      minCheckSize: llparse.constants.DEFAULT_TRANSLATOR_MIN_CHECK_SIZE,

      // Maximum width of entry in a bitfield for a `BitCheck` optimization
      maxCheckWidth: llparse.constants.DEFAULT_TRANSLATOR_MAX_CHECK_WIDTH
    }, this.ctx.options.translator);

    this.nodes = new Map();
    this.maxSequenceLen = 0;
  }

  build() {
    return {
      root: this.buildNode(this.ctx.root, null),
      maxSequenceLen: this.maxSequenceLen
    };
  }

  id(node, postfix = '') {
    return this.ctx.id(node.name, postfix);
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
    } else if (node instanceof llparse.node.Pause) {
      res = new compiler.node.Pause(this.id(node), node.code, node.reason);
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
    assert.notStrictEqual(trie.children.length, 0);

    // Fast case, every child leads to the same result and no values are passed
    const bitCheck = this.buildBitCheck(node, trie, list, isRoot);
    if (bitCheck)
      return bitCheck;

    const res = new compiler.node.Single(this.id(node));

    // Break loops
    if (isRoot)
      this.nodes.set(node, res);

    res.transform = node[kTransform];
    res.children = trie.children.map((child) => {
      return {
        key: child.key,
        next: this.buildTrie(node, child.child, list),
        noAdvance: child.noAdvance,
        value: child.child.value
      };
    });

    list.push(res);
    return res;
  }

  buildBitCheck(node, trie, list, isRoot) {
    if (trie.children.length < this.options.minCheckSize)
      return false;

    const targets = new Map();

    const bailout = !trie.children.every((child) => {
      if (child.child.value !== null)
        return false;

      if (child.child.type !== 'next')
        return false;

      const target = child.child.next;
      if (!targets.has(target)) {
        targets.set(target, {
          noAdvance: child.noAdvance,
          keys: [ child.key ],
          trie: child.child
        });
        return true;
      }

      const existing = targets.get(target);

      // TODO(indutny): just use it as a sub-key?
      if (existing.noAdvance !== child.noAdvance) {
        debugOpt('Can\'t transform single to bitcheck due to ' +
          '`.peek()`/`.match()` conflict');
        return false;
      }

      existing.keys.push(child.key);
      return true;
    });

    if (bailout)
      return false;

    // We've width limit for this optimization
    if (targets.size >= (1 << this.options.maxCheckWidth)) {
      debugOpt('Can\'t transform single to bitcheck due to ' +
        'large distinct target count=%d', targets.size);
      return false;
    }

    const res = new compiler.node.BitCheck(this.id(node));

    // Break loops
    if (isRoot)
      this.nodes.set(node, res);

    res.transform = node[kTransform];

    const map = [];
    let totalKeys = 0;
    targets.forEach((info) => {
      const next = this.buildTrie(node, info.trie, list);
      totalKeys += info.keys.length;
      map.push({ node: next, noAdvance: info.noAdvance, keys: info.keys });
    });
    res.map = map;

    debugOpt('Transformed Single into BitCheck targets.len=%d total_keys=%d',
      res.map.length, totalKeys);

    list.push(res);
    return res;
  }

  buildSequence(node, trie, list, isRoot) {
    const res = new compiler.node.Sequence(this.id(node), trie.select);
    const value = trie.child.type === 'next' ? trie.child.value : null;

    this.maxSequenceLen = Math.max(this.maxSequenceLen, trie.select.length);

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
