import * as assert from 'assert';
import * as debug from 'debug';

import * as node from '../../node';
import { Trie, TrieNode, TrieSingle, TrieSequence, TrieNext } from '../../trie';
import { Compilation } from '../compilation';
import * as compilerNode from '../node';
import { Stage } from './base';

const debugOpt = debug('llparse:opt');

type TrieOutputList = compilerNode[];

export interface INodeTranslatorOptions {
  // Minimum number of cases of `single` node to make it eligable for
  // `BitCheck` optimization
  minCheckSize: number | undefined;

  // Maximum width of entry in a bitfield for a `BitCheck` optimization
  maxCheckWidth: number | undefined;
}

export class NodeTranslator extends Stage {
  private readonly options: INodeTranslatorOptions;
  private readonly nodes: Map<node.Node, compilerNode.Node> = new Map();
  private readonly errorCache: Map<string, compilerNode.Error> = new Map();
  private maxSequenceLen: number = 0;

  constructor(ctx: Compilation, options: INodeTranslatorOptions) {
    super(ctx, 'node-translator');

    this.options = Object.assign({
      minCheckSize: llparse.constants.DEFAULT_TRANSLATOR_MIN_CHECK_SIZE,

      maxCheckWidth: llparse.constants.DEFAULT_TRANSLATOR_MAX_CHECK_WIDTH
    }, options);
  }

  public build(): any {
    return {
      root: this.buildNode(this.ctx.root, undefined),
      maxSequenceLen: this.maxSequenceLen
    };
  }

  private id(node: node.Node, postfix: string = '') {
    return this.ctx.id(node.name, 'n_', postfix);
  }

  private buildNode(node: node.Node, value: number | undefined) {
    this.checkSignature(node, value);

    if (this.nodes.has(node)) {
      return this.nodes.get(node);
    }

    let res;
    let list: TrieOutputList | undefined;
    let last;
    if (node instanceof node.Invoke) {
      res = new compilerNode.Invoke(this.id(node), node.code);
    } else if (node instanceof node.Error) {
      res = this.buildError(node);
    } else if (node instanceof node.SpanStart) {
      res = new compilerNode.SpanStart(this.id(node), node.code);
    } else if (node instanceof node.SpanEnd) {
      res = new compilerNode.SpanEnd(this.id(node), node.code);
    } else if (node instanceof node.Pause) {
      res = new compilerNode.Pause(this.id(node), node.code, node.reason);
    } else if (node instanceof node.Consume) {
      res = new compilerNode.Consume(this.id(node), node.fieldName);
    } else {
      assert(node instanceof node.Match);

      const trie = new Trie(node.name);

      const combined = trie.combine(node.cases);
      if (combined === null) {
        res = new compilerNode.Empty(this.id(node));
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
      Object.keys(node.map).forEach((key) => {
        res.add(key, this.buildNode(node.map[key], undefined));
      });
    }

    if (node instanceof llparse.node.Error) {
      assert.strictEqual(node.getOtherwise(), undefined);
    } else {
      const otherwise = node.getOtherwise();
      assert.notStrictEqual(node.otherwise, undefined,
        `Node "${node.name}" must have \`.otherwise()\`/\`.skipTo()\``);

      if (!list)
        list = [ last ];
      const otherwise = this.buildNode(otherwise.next, null);
      list.forEach((entry) => {
        entry.setOtherwise(otherwise, otherwise.skip);
      });
    }

    // Do a "peephole"-like optimization. If there are empty nodes that do
    // not skip over the input, and lead to nodes with prologue check
    // (p != endp) - stitch the node straight to its `otherwise` recursively.
    for (;;) {
      if (!(res instanceof compilerNode.Empty))
        break;
      if (res.skip)
        break;

      const otherwise = res.otherwise;
      // Since we're running in de-looped mode, sometimes `otherwise` may not
      // be set yet.
      if (!otherwise || otherwise.noPrologueCheck)
        break;

      res = otherwise;
    }

    return res;
  }

  private buildError(node: node.Error): complerNode.Error {
    const cacheKey = (node.code >>> 0) + ':' + node.reason;
    if (this.errorCache.has(cacheKey))
      return this.errorCache.get(cacheKey);

    const res = new compilerNode.Error(this.id(node), node.code, node.reason);
    this.errorCache.set(cacheKey, res);
    return res;
  }

  private buildTrie(node: node.Match, trie: TrieNode, list: TrieOutputList,
                    isRoot: boolean = false): compilerNode.Node {
    if (trie instanceof TrieNext) {
      assert(!isRoot);
      return this.buildNode(trie.next, trie.value);
    }

    if (trie instanceof TrieSingle) {
      return this.buildSingle(node, trie, list, isRoot);
    }

    if (trie instanceof TrieSequence) {
      return this.buildSequence(node, trie, list, isRoot);
    }

    throw new Error('Unknown trie node');
  }

  private buildSingle(node: node.Match, trie: TrieSingle, list: TrieOutputList,
                      isRoot: boolean): compilerNode.Node {
    assert.notStrictEqual(trie.children.length, 0);

    // Fast case, every child leads to the same result and no values are passed
    const bitCheck = this.buildBitCheck(node, trie, list, isRoot);
    if (bitCheck) {
      return bitCheck;
    }

    const res = new compiler.node.Single(this.id(node));

    // Break loops
    if (isRoot) {
      this.nodes.set(node, res);
    }

    res.transform = node.getTransform();
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

  private buildBitCheck(node: node.Match, trie: TrieSingle,
                        list: TrieOutputList, isRoot: boolean)
    : compilerNode.Node | false {
    if (trie.children.length < this.options.minCheckSize) {
      return false;
    }

    const targets = new Map();

    const bailout = !trie.children.every((child) => {
      if (child.child.value !== null) {
        return false;
      }

      if (child.child.type !== 'next') {
        return false;
      }

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

    if (bailout) {
      return false;
    }

    // We've width limit for this optimization
    if (targets.size >= (1 << this.options.maxCheckWidth)) {
      debugOpt('Can\'t transform single to bitcheck due to ' +
        'large distinct target count=%d', targets.size);
      return false;
    }

    const res = new compiler.node.BitCheck(this.id(node));

    // Break loops
    if (isRoot) {
      this.nodes.set(node, res);
    }

    res.transform = node.getTransform();

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

  private buildSequence(node: node.Match, trie: TrieSequence,
                        list: TrieOutputList, isRoot: boolean)
    : compilerNode.Node {
    const res = new compiler.node.Sequence(this.id(node), trie.select);
    const value = trie.child.type === 'next' ? trie.child.value : null;

    this.maxSequenceLen = Math.max(this.maxSequenceLen, trie.select.length);

    // Break loops
    if (isRoot) {
      this.nodes.set(node, res);
    }

    res.transform = node.getTransform();
    res.next = this.buildTrie(node, trie.child, list);
    res.value = value;

    list.push(res);
    return res;
  }

  private checkSignature(node: node.Node, value: number | undefined) {
    assert.strictEqual(node.signature,
      value === undefined ? 'match' : 'value');
  }
}
