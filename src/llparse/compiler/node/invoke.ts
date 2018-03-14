import * as assert from 'assert';

import { Code } from '../code';
import { Compilation, BasicBlock, INodeID } from '../compilation';
import { Node, INodeChild } from './base';

export class Invoke extends Node {
  private readonly map: Map<number, Node> = new Map();

  constructor(id: INodeID, private readonly code: Code) {
    super('invoke', id);

    this.code = code;
    this.privNoPrologueCheck = true;
  }

  public add(key: number, node: Node): void {
    assert(!this.map.has(key));
    this.map.set(key, node);
  }

  public getChildren(): ReadonlyArray<INodeChild> {
    return super.getChildren().concat(this.map.forEach((node) => {
      return { node, noAdvance: true, key: null };
    }));
  }

  protected doBuild(ctx: Compilation, body: BasicBlock): void {
    const code = ctx.compilation.buildCode(this.code);

    const args = [
      ctx.state,
      ctx.pos.current,
      ctx.endPos
    ];

    if (this.code[kSignature] === 'value')
      args.push(ctx.match);
    else
      assert.strictEqual(this.code[kSignature], 'match');

    const call = body.call(code, args);

    const keys = Object.keys(this.map).map(key => key | 0);

    const weights = new Array(1 + keys.length).fill('likely');

    // Mark error branches as unlikely
    keys.forEach((key, i) => {
      if (this.map[key] instanceof node.Error)
        weights[i + 1] = 'unlikely';
    });

    if (this.otherwise instanceof node.Error)
      weights[0] = 'unlikely';

    const s = ctx.buildSwitch(body, call, keys, weights);
    s.cases.forEach((body, i) => {
      this.tailTo(ctx, body, ctx.pos.current, this.map[keys[i]]);
    });

    this.doOtherwise(ctx, s.otherwise);
  }
}
