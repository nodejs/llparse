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
import { MatchSequence } from '../match-sequence';
import * as compiler from '../node';
import { ISpanAllocatorResult, Span } from '../span';
import * as compilerTransform from '../transform';
import { Identifier, IUniqueName } from '../utils';
import { Trie, TrieEmpty, TrieNode, TrieSequence, TrieSingle } from './trie';

type IMatchResult = compiler.Node | ReadonlyArray<compiler.Match>;

interface IPauseResult {
  readonly pause: compiler.Node;
  readonly resume: compiler.Node;
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
  public readonly spans: ReadonlyArray<Span>;

  private readonly options: ITranslatorOptions;
  private readonly id: Identifier = new Identifier(this.prefix + '__n_');
  private readonly codeId: Identifier = new Identifier(this.prefix + '__c_');
  private readonly map: Map<api.Node, compiler.Node> = new Map();
  private readonly spanMap: Map<APISpan, Span> = new Map();
  private readonly codeCache: Map<string, compilerCode.Code> = new Map();
  private readonly matchSequenceCache: Map<string, MatchSequence> = new Map();

  constructor(private readonly prefix: string,
              options: ITranslatorLazyOptions,
              spans: ISpanAllocatorResult) {
    this.options = {
      maxTableElemWidth: options.maxTableElemWidth === undefined ?
        DEFAULT_TRANSLATOR_MAX_TABLE_WIDTH : options.maxTableElemWidth,
      minTableSize: options.minTableSize === undefined ?
        DEFAULT_TRANSLATOR_MIN_TABLE_SIZE : options.minTableSize,
    };

    assert(0 < this.options.maxTableElemWidth,
      'Invalid `maxTableElemWidth`, must be positive');

    this.spans = spans.concurrency.map((concurrent, index) => {
      const span = new Span(index, concurrent.map((apiSpan) => {
        return this.translateCode(apiSpan.callback) as compilerCode.Span;
      }));

      for (const apiSpan of concurrent) {
        this.spanMap.set(apiSpan, span);
      }

      return span;
    });
  }

  public translate(node: api.Node): compiler.Node {
    if (this.map.has(node)) {
      return this.map.get(node)!;
    }

    let result: compiler.Node | ReadonlyArray<compiler.Match> | IPauseResult;

    const id = (): IUniqueName => this.id.id(node.name);

    // Instantiate target class
    if (node instanceof api.Error) {
      result = new compiler.Error(id(), node.code, node.reason);
    } else if (node instanceof api.Pause) {
      result = this.translatePause(node);
    } else if (node instanceof api.Consume) {
      result = new compiler.Consume(id(), node.field);
    } else if (node instanceof api.SpanStart) {
      result = new compiler.SpanStart(id(), this.spanMap.get(node.span)!,
        this.translateCode(node.span.callback) as compilerCode.Span);
    } else if (node instanceof api.SpanEnd) {
      result = new compiler.SpanEnd(id(), this.spanMap.get(node.span)!,
        this.translateCode(node.span.callback) as compilerCode.Span);
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
      const transform = this.translateTransform(match.getTransform());
      for (const child of result) {
        child.setTransform(transform);
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
          result.addEdge(edge.key as number, this.translate(edge.node));
        }
      } else {
        assert.strictEqual(Array.from(node).length, 0);
      }

      return result;
    } else {
      assert(node instanceof api.Pause);

      const { pause, resume } = result as IPauseResult;
      this.map.set(node, pause);

      if (otherwise !== undefined) {
        resume.setOtherwise(this.translate(otherwise.node),
          otherwise.noAdvance);
      } else {
        // TODO(indutny): move this to llparse-builder?
        assert(node instanceof api.Error,
          `Node "${node.name}" has no \`.otherwise()\``);
      }

      return pause;
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
        value: child.node instanceof TrieEmpty ? child.node.value : undefined,
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
    const matchSequence = this.createMatchSequence(node);
    matchSequence.addSequence(trie.select);

    const sequence = new compiler.Sequence(this.id.id(node.name), matchSequence,
      trie.select);
    children.push(sequence);

    // Break the loop
    if (!this.map.has(node)) {
      this.map.set(node, sequence);
    }

    const childNode = this.translateTrie(node, trie.child, children);

    const value = trie.child instanceof TrieEmpty ?
      trie.child.value : undefined;

    sequence.setEdge(childNode, value);

    return sequence;
  }

  private translateCode(code: apiCode.Code): compilerCode.Code {
    const prefixed = this.codeId.id(code.name).name;
    let res: compilerCode.Code;
    if (code instanceof apiCode.IsEqual) {
      res = new compilerCode.IsEqual(prefixed, code.field, code.value);
    } else if (code instanceof apiCode.Load) {
      res = new compilerCode.Load(prefixed, code.field);
    } else if (code instanceof apiCode.MulAdd) {
      res = new compilerCode.MulAdd(prefixed, code.field, {
        base: code.options.base,
        max: code.options.max,
        signed: code.options.signed === undefined ? true : code.options.signed,
      });
    } else if (code instanceof apiCode.Or) {
      res = new compilerCode.Or(prefixed, code.field, code.value);
    } else if (code instanceof apiCode.Store) {
      res = new compilerCode.Store(prefixed, code.field);
    } else if (code instanceof apiCode.Test) {
      res = new compilerCode.Test(prefixed, code.field, code.value);
    } else if (code instanceof apiCode.Update) {
      res = new compilerCode.Update(prefixed, code.field, code.value);

    // External callbacks
    } else if (code instanceof apiCode.Match) {
      res = new compilerCode.Match(code.name);
    } else if (code instanceof apiCode.Span) {
      res = new compilerCode.Span(code.name);
    } else if (code instanceof apiCode.Value) {
      res = new compilerCode.Value(code.name);
    } else {
      throw new Error(`Unsupported code: "${code.name}"`);
    }

    // Re-use instances to build them just once
    if (this.codeCache.has(res.cacheKey)) {
      return this.codeCache.get(res.cacheKey)!;
    }

    this.codeCache.set(res.cacheKey, res);
    return res;
  }

  private translatePause(node: api.Pause): IPauseResult {
    const pause = new compiler.Pause(this.id.id(node.name), node.code,
      node.reason);
    const resume = new compiler.Resume(this.id.id(node.name + '_resume'),
      node.code);

    pause.setOtherwise(resume, true);

    return { pause, resume };
  }

  private translateTransform(transform?: apiTransform.Transform)
    : compilerTransform.Transform {
    if (transform === undefined) {
      return new compilerTransform.ID();
    } else if (transform.name === 'to_lower_unsafe') {
      return new compilerTransform.ToLowerUnsafe();
    } else {
      throw new Error(`Unsupported transform: "${transform.name}"`);
    }
  }

  private createMatchSequence(node: api.Match): MatchSequence {
    const transform = this.translateTransform(node.getTransform());
    const cacheKey = transform === undefined ? '' : transform.name;

    if (this.matchSequenceCache.has(cacheKey)) {
      return this.matchSequenceCache.get(cacheKey)!;
    }

    const res = new MatchSequence(transform);
    this.matchSequenceCache.set(cacheKey, res);
    return res;
  }
}
