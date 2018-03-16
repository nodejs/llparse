import * as assert from 'assert';
import { Buffer } from 'buffer';
import { code as apiCode, node as api, Span as APISpan } from 'llparse-builder';

import * as compilerCode from '../code';
import * as compiler from '../node';
import { ISpanAllocatorResult, Span } from '../span';
import { Identifier, IUniqueName } from '../utils';
import { Trie, TrieEmpty, TrieNode, TrieSequence, TrieSingle } from './trie';

interface IMatchResult {
  readonly children: ReadonlyArray<compiler.Node>;
  readonly result: compiler.Node;
}

export class Translator {
  private readonly id: Identifier = new Identifier(this.prefix + '_n_');
  private readonly map: Map<api.Node, compiler.Node> = new Map();
  private readonly spanMap: Map<APISpan, Span> = new Map();

  constructor(private readonly prefix: string,
              private readonly spans: ISpanAllocatorResult) {
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

  private translateSequence(node: api.Node, trie: TrieSequence,
                            children: compiler.Node[]): compiler.Node {
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
