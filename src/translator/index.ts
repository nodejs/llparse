import * as assert from 'assert';
import { Buffer } from 'buffer';
import { code as apiCode, node as api, Span as APISpan } from 'llparse-builder';

import * as compilerCode from '../code';
import * as compiler from '../node';
import { ISpanAllocatorResult, Span } from '../span';
import { Identifier, IUniqueName } from '../utils';
import { Trie, TrieEmpty, TrieSequence, TrieSingle } from './trie';

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
    const id = this.id.id(node.name);

    // Instantiate target class
    if (node instanceof api.Error) {
      result = new compiler.Error(id, node.code, node.reason);
    } else if (node instanceof api.Pause) {
      result = new compiler.Pause(id, node.code, node.reason);
    } else if (node instanceof api.Consume) {
      result = new compiler.Consume(id, node.field);
    } else if (node instanceof api.SpanStart) {
      result = new compiler.SpanStart(id, this.spanMap.get(node.span)!);
    } else if (node instanceof api.SpanEnd) {
      result = new compiler.SpanEnd(id, this.spanMap.get(node.span)!);
    } else if (node instanceof api.Invoke) {
      result = new compiler.Invoke(id, this.translateCode(node.code));
    } else if (node instanceof api.Match) {
      result = this.translateMatch(id, node);
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
      // Should be handled by `translateMatch`
    } else if (result instanceof compiler.Invoke) {
      for (const edge of node) {
        result.addEdge(this.translate(edge.node), edge.key as number);
      }
    } else {
      assert.strictEqual(Array.from(node).length, 0);
    }

    return result;
  }

  private translateMatch(id: IUniqueName, node: api.Match): compiler.Node {
    const trie = new Trie(id.originalName);

    const trieNode = trie.build(Array.from(node));

    return new compiler.Empty(id);
  }

  private translateCode(code: apiCode.Code): compilerCode.Code {
    return new compilerCode.Match('todo');
  }
}
