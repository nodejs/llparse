import * as assert from 'assert';
import { Buffer } from 'buffer';
import {
  code as apiCode,
  node as api,
  Span as APISpan,
  transform as apiTransform,
} from 'llparse-builder';

import * as compilerCode from '../code';
import {
  DEFAULT_TRANSLATOR_MAX_TABLE_WIDTH,
  DEFAULT_TRANSLATOR_MIN_TABLE_SIZE,
} from '../constants';
import * as compiler from '../node';
import { ISpanAllocatorResult, Span } from '../span';
import * as compilerTransform from '../transform';
import { Identifier, IUniqueName } from '../utils';
import { Trie, TrieEmpty, TrieNode, TrieSequence, TrieSingle } from './trie';

type IMatchResult = compiler.Node | ReadonlyArray<compiler.Match>;

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
  private readonly codeCache: Map<string, compilerCode.Code> = new Map();

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
        return this.translateCode(apiSpan.callback) as compilerCode.Span;
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

    let result: compiler.Node | ReadonlyArray<compiler.Match>;

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
      result = this.translateMatch(node);
    } else {
      throw new Error(`Unknown node type for "${node.name}"`);
    }

    // Initialize result
    const otherwise = node.getOtherwiseEdge();

    if (Array.isArray(result)) {
      assert(node instanceof api.Match);
      const match = node as api.Match;

      // TODO(indutny): move this to llparse-builder?
      assert.notStrictEqual(otherwise, undefined,
        `Node "${node.name}" has no \`.otherwise()\``);

      // Assign otherwise to every node of Trie
      if (otherwise !== undefined) {
        for (const child of result) {
          child.setOtherwise(this.translate(otherwise.node),
            otherwise.noAdvance);
        }
      }

      // Assign transform to every node of Trie
      const transform = match.getTransform();
      if (transform !== undefined) {
        const translated = this.translateTransform(transform);
        for (const child of result) {
          child.setTransform(translated);
        }
      }

      assert(result.length >= 1);
      return result[0];
    } else if (result instanceof compiler.Node) {
      // Break loops
      this.map.set(node, result);

      if (otherwise !== undefined) {
        result.setOtherwise(this.translate(otherwise.node),
          otherwise.noAdvance);
      } else {
        // TODO(indutny): move this to llparse-builder?
        assert(node instanceof api.Error,
          `Node "${node.name}" has no \`.otherwise()\``);
      }

      if (result instanceof compiler.Invoke) {
        for (const edge of node) {
          result.addEdge(this.translate(edge.node), edge.key as number);
        }
      } else {
        assert.strictEqual(Array.from(node).length, 0);
      }

      return result;
    } else {
      throw new Error('Unreachable');
    }
  }

  private translateMatch(node: api.Match): IMatchResult {
    const trie = new Trie(node.name);

    const otherwise = node.getOtherwiseEdge();
    const trieNode = trie.build(Array.from(node));
    if (trieNode === undefined) {
      return new compiler.Empty(this.id.id(node.name));
    }

    const children: compiler.Match[] = [];
    this.translateTrie(node, trieNode, children);
    assert(children.length >= 1);

    return children;
  }

  private translateTrie(node: api.Match, trie: TrieNode,
                        children: compiler.Match[]): compiler.Node {
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

  private translateSingle(node: api.Match, trie: TrieSingle,
                          children: compiler.Match[]): compiler.Match {
    // See if we can apply TableLookup optimization
    const maybeTable = this.maybeTableLookup(node, trie, children);
    if (maybeTable !== undefined) {
      return maybeTable;
    }

    const single = new compiler.Single(this.id.id(node.name));
    children.push(single);

    // Break the loop
    if (!this.map.has(node)) {
      this.map.set(node, single);
    }
    for (const child of trie.children) {
      const childNode = this.translateTrie(node, child.node, children);

      single.addEdge({
        key: child.key,
        noAdvance: child.noAdvance,
        node: childNode,
      });
    }
    return single;
  }

  private maybeTableLookup(node: api.Match, trie: TrieSingle,
                           children: compiler.Match[])
    : compiler.Match | undefined {
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

    const table = new compiler.TableLookup(this.id.id(node.name));
    children.push(table);

    // Break the loop
    if (!this.map.has(node)) {
      this.map.set(node, table);
    }

    targets.forEach((target) => {
      const next = this.translateTrie(node, target.trie, children);

      table.addEdge({
        keys: target.keys,
        noAdvance: target.noAdvance,
        node: next,
      });
    });

    return table;
  }

  private translateSequence(node: api.Match, trie: TrieSequence,
                            children: compiler.Match[]): compiler.Match {
    const sequence = new compiler.Sequence(this.id.id(node.name), trie.select);
    children.push(sequence);

    // Break the loop
    if (!this.map.has(node)) {
      this.map.set(node, sequence);
    }

    const childNode = this.translateTrie(node, trie.child, children);

    sequence.setOnMatch(childNode);

    return sequence;
  }

  private translateCode(code: apiCode.Code): compilerCode.Code {
    const name = code.name;
    let res: compilerCode.Code;
    if (code instanceof apiCode.IsEqual) {
      res = new compilerCode.IsEqual(name, code.field, code.value);
    } else if (code instanceof apiCode.Load) {
      res = new compilerCode.Load(name, code.field);
    } else if (code instanceof apiCode.MulAdd) {
      res = new compilerCode.MulAdd(name, code.field, code.options);
    } else if (code instanceof apiCode.Or) {
      res = new compilerCode.Or(name, code.field, code.value);
    } else if (code instanceof apiCode.Store) {
      res = new compilerCode.Store(name, code.field);
    } else if (code instanceof apiCode.Test) {
      res = new compilerCode.Test(name, code.field, code.value);
    } else if (code instanceof apiCode.Update) {
      res = new compilerCode.Update(name, code.field, code.value);

    // External callbacks
    } else if (code instanceof apiCode.Match) {
      res = new compilerCode.Match(name);
    } else if (code instanceof apiCode.Span) {
      res = new compilerCode.Span(name);
    } else if (code instanceof apiCode.Value) {
      res = new compilerCode.Value(name);
    } else {
      throw new Error(`Unsupported code: "${name}"`);
    }

    // Re-use instances to build them just once
    if (this.codeCache.has(res.cacheKey)) {
      return this.codeCache.get(res.cacheKey)!;
    }

    this.codeCache.set(res.cacheKey, res);
    return res;
  }

  private translateTransform(transform: apiTransform.Transform)
    : compilerTransform.Transform {
    if (transform.name === 'to_lower_unsafe') {
      return new compilerTransform.ToLowerUnsafe();
    } else {
      throw new Error(`Unsupported transform: "${transform.name}"`);
    }
  }
}
