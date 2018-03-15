import * as assert from 'assert';
import { Buffer } from 'buffer';
import { code as apiCode, node as api } from 'llparse-builder';

import * as compilerCode from '../code';
import * as compiler from '../node';
import { Identifier, IUniqueName } from '../utils';

export class Translator {
  private readonly id: Identifier = new Identifier('n_');
  private readonly map: Map<api.Node, compiler.Node> = new Map();

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
      result = new compiler.SpanStart(id, node.span,
        this.translateCode(node.callback) as compilerCode.Span);
    } else if (node instanceof api.SpanEnd) {
      result = new compiler.SpanEnd(id, node.span,
        this.translateCode(node.callback) as compilerCode.Span);
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
    return new compiler.Empty(id);
  }

  private translateCode(code: apiCode.Code): compilerCode.Code {
    return new compilerCode.Match('todo');
  }
}
