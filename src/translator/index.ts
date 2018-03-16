import * as assert from 'assert';
import { Buffer } from 'buffer';
import { code as apiCode, node as api, Span as APISpan } from 'llparse-builder';

import * as compilerCode from '../code';
import {
  DEFAULT_TRANSLATOR_MAX_TABLE_WIDTH,
  DEFAULT_TRANSLATOR_MIN_TABLE_SIZE,
} from '../constants';
import * as compiler from '../node';
import { ISpanAllocatorResult, Span } from '../span';
import { Identifier, IUniqueName } from '../utils';
import { Trie, TrieEmpty, TrieNode, TrieSequence, TrieSingle } from './trie';

interface IMatchResult {
  readonly children: ReadonlyArray<compiler.Node>;
  readonly result: compiler.Node;
}

interface ITableLookupTarget {
  readonly keys: number[];
  readonly noAdvance: boolean;
  readonly trie: TrieEmpty;
}

interface ITranslatorOptions {
  readonly maxTableElemWidth: number;
  readonly minTableSize: number;
}

export interface ITranslatorLazyOptions {
  readonly maxTableElemWidth?: number;
  readonly minTableSize?: number;
}

export class Translator {
  private readonly options: ITranslatorOptions;
  private readonly id: Identifier = new Identifier(this.prefix + '_n_');
  private readonly map: Map<api.Node, compiler.Node> = new Map();
  private readonly spanMap: Map<APISpan, Span> = new Map();

  constructor(private readonly prefix: string,
              options: ITranslatorLazyOptions,
              private readonly spans: ISpanAllocatorResult) {
    this.options = {
      maxTableElemWidth: options.maxTableElemWidth === undefined ?
        DEFAULT_TRANSLATOR_MAX_TABLE_WIDTH : options.maxTableElemWidth,
      minTableSize: options.minTableSize === undefined ?
        DEFAULT_TRANSLATOR_MIN_TABLE_SIZE : options.minTableSize,
    };

    assert(0 < this.options.maxTableElemWidth,
      'Invalid `maxTableElemWidth`, must be positive');

    spans.concurrency.forEach((concurrent, index) => {
      const span = new Span(index, concurrent.map((apiSpan) => {
        return this.translateCode(apiSpan.callback);
      }));

      for (const apiSpan of concurrent) {
        this.spanMap.set(apiSpan, span);
      }
    });
  }

  public translate(node: api.Node): compiler.Node {
    if (this.map.has(node)) {
      return this.map.get(node)!;
    }

    let result: compiler.Node;
    let children: ReadonlyArray<compiler.Node> | undefined;

    const id = (): IUniqueName => this.id.id(node.name);

    // Instantiate target class
    if (node instanceof api.Error) {
      result = new compiler.Error(id(), node.code, node.reason);
    } else if (node instanceof api.Pause) {
      result = new compiler.Pause(id(), node.code, node.reason);
    } else if (node instanceof api.Consume) {
      result = new compiler.Consume(id(), node.field);
    } else if (node instanceof api.SpanStart) {
      result = new compiler.SpanStart(id(), this.spanMap.get(node.span)!);
    } else if (node instanceof api.SpanEnd) {
      result = new compiler.SpanEnd(id(), this.spanMap.get(node.span)!);
    } else if (node instanceof api.Invoke) {
      result = new compiler.Invoke(id(), this.translateCode(node.code));
    } else if (node instanceof api.Match) {
      const match = this.translateMatch(node);
      result = match.result;
      children = match.children;
    } else {
      throw new Error(`Unknown node type for "${node.name}"`);
    }

    // Break loops
    this.map.set(node, result);

    // Initialize result
    const otherwise = node.getOtherwiseEdge();
    if (otherwise !== undefined) {
      result.setOtherwise(this.translate(otherwise.node), otherwise.noAdvance);
    }

    if (node instanceof api.Match) {
      // Assign otherwise to every node of Trie
      if (otherwise !== undefined) {
        for (const child of children!) {
          result.setOtherwise(this.translate(otherwise.node),
            otherwise.noAdvance);
        }
      }
    } else if (result instanceof compiler.Invoke) {
      for (const edge of node) {
        result.addEdge(this.translate(edge.node), edge.key as number);
      }
    } else {
      assert.strictEqual(Array.from(node).length, 0);
    }

    return result;
  }

  private translateMatch(node: api.Match): IMatchResult {
    const trie = new Trie(node.name);

    const otherwise = node.getOtherwiseEdge();
    const trieNode = trie.build(Array.from(node));
    if (trieNode === undefined) {
      return {
        children: [],
        result: new compiler.Empty(this.id.id(node.name)),
      };
    }

    const children: compiler.Node[] = [];
    const result = this.translateTrie(node, trieNode, children);

    return { result, children };
  }

  private translateTrie(node: api.Node, trie: TrieNode,
                        children: compiler.Node[]): compiler.Node {
    if (trie instanceof TrieEmpty) {
      assert(this.map.has(node));
      return this.translate(trie.node);
    } else if (trie instanceof TrieSingle) {
      return this.translateSingle(node, trie, children);
    } else if (trie instanceof TrieSequence) {
      return this.translateSequence(node, trie, children);
    } else {
      throw new Error('Unknown trie node');
    }
  }

  private translateSingle(node: api.Node, trie: TrieSingle,
                          children: compiler.Node[]): compiler.Node {
    // See if we can apply TableLookup optimization
    const maybeTable = this.maybeTableLookup(node, trie, children);
    if (maybeTable !== undefined) {
      return maybeTable;
    }

    // TODO(indutny): transform
    const single = new compiler.Single(this.id.id(node.name));

    // Break the loop
    if (!this.map.has(node)) {
      this.map.set(node, single);
    }
    for (const child of trie.children) {
      const childNode = this.translateTrie(node, child.node, children);
      children.push(childNode);

      single.addEdge({
        key: child.key,
        noAdvance: child.noAdvance,
        node: childNode,
      });
    }
    return single;
  }

  private maybeTableLookup(node: api.Node, trie: TrieSingle,
                           children: compiler.Node[])
    : compiler.Node | undefined {
    if (trie.children.length < this.options.minTableSize) {
      return undefined;
    }

    const targets: Map<api.Node, ITableLookupTarget> = new Map();

    const bailout = !trie.children.every((child) => {
      if (!(child.node instanceof TrieEmpty)) {
        return false;
      }

      const empty: TrieEmpty = child.node;

      // We can't pass values from the table yet
      if (empty.value !== undefined) {
        return false;
      }

      const target = empty.node;
      if (!targets.has(target)) {
        targets.set(target, {
          keys: [ child.key ],
          noAdvance: child.noAdvance,
          trie: empty,
        });
        return true;
      }

      const existing = targets.get(target)!;

      // TODO(indutny): just use it as a sub-key?
      if (existing.noAdvance !== child.noAdvance) {
        return false;
      }

      existing.keys.push(child.key);
      return true;
    });

    if (bailout) {
      return undefined;
    }

    // We've width limit for this optimization
    if (targets.size >= (1 << this.options.maxTableElemWidth)) {
      return undefined;
    }

    // TODO(indutny): transform
    const table = new compiler.TableLookup(this.id.id(node.name));

    // Break the loop
    if (!this.map.has(node)) {
      this.map.set(node, table);
    }

    targets.forEach((target) => {
      const next = this.translateTrie(node, target.trie, children);
      children.push(next);

      table.addEdge({
        keys: target.keys,
        noAdvance: target.noAdvance,
        node: next,
      });
    });

    return table;
  }

  private translateSequence(node: api.Node, trie: TrieSequence,
                            children: compiler.Node[]): compiler.Node {
    // TODO(indutny): transform
    const sequence = new compiler.Sequence(this.id.id(node.name), trie.select);

    // Break the loop
    if (!this.map.has(node)) {
      this.map.set(node, sequence);
    }

    const childNode = this.translateTrie(node, trie.child, children);
    children.push(childNode);

    sequence.setOnMatch(childNode);

    return sequence;
  }

  private translateCode(code: apiCode.Code): compilerCode.Code {
    const name = code.name;
    if (code instanceof apiCode.IsEqual) {
      return new compilerCode.IsEqual(name, code.field, code.value);
    } else if (code instanceof apiCode.Load) {
      return new compilerCode.Load(name, code.field);
    } else if (code instanceof apiCode.MulAdd) {
      return new compilerCode.MulAdd(name, code.field, code.options);
    } else if (code instanceof apiCode.Or) {
      return new compilerCode.Or(name, code.field, code.value);
    } else if (code instanceof apiCode.Store) {
      return new compilerCode.Store(name, code.field);
    } else if (code instanceof apiCode.Test) {
      return new compilerCode.Test(name, code.field, code.value);
    } else if (code instanceof apiCode.Update) {
      return new compilerCode.Update(name, code.field, code.value);

    // External callbacks
    } else if (code instanceof apiCode.Match) {
      return new compilerCode.Match(name);
    } else if (code instanceof apiCode.Span) {
      return new compilerCode.Span(name);
    } else if (code instanceof apiCode.Value) {
      return new compilerCode.Value(name);
    } else {
      throw new Error(`Unsupported code: "${name}"`);
    }
  }
}
