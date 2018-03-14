import { Compilation, BasicBlock, INodeID } from '../compilation';
import { Node, INodeChild } from './base';

export class Single extends Node {
  private readonly children: INodeChild[] = [];

  constructor(id: NodeID) {
    super('single', id);
  }

  public add(child: INodeChild): void {
    this.children.push(child);
  }

  public getChildren(): ReadonlyArray<INodeChild> {
    return super.getChildren().concat(this.children);
  }

  protected doBuild(ctx: Compilation, body: BasicBlock): void {
    const pos = ctx.pos.current;

    // Load the character
    let current = body.load(pos);

    // Transform the character if needed
    if (this.transform) {
      const res  = ctx.compilation.buildTransform(this.transform,
        body, current);
      body = res.body;
      current = res.current;
    }

    const weights = new Array(1 + this.children.length).fill('likely');

    // Mark error branches as unlikely
    this.children.forEach((child, i) => {
      if (child.node instanceof node.Error)
        weights[i + 1] = 'unlikely';
    });

    if (this.otherwise instanceof node.Error)
      weights[0] = 'unlikely';

    const keys = this.children.map(child => child.key);
    const s = ctx.buildSwitch(body, current, keys, weights);

    s.cases.forEach((body, i) => {
      const child = this.children[i];

      this.tailTo(ctx, body, child.noAdvance ? ctx.pos.current : ctx.pos.next,
        child.node, child.value);
    });

    this.doOtherwise(ctx, s.otherwise);
  }
}
