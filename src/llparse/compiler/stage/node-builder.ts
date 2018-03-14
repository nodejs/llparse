import { Compilation, Func } from '../compilation';
import { Node } from '../node';
import { Stage } from './base';

export class NodeBuilder extends Stage {
  private readonly nodes: Map<Node, Func> = new Map();

  constructor(ctx: Compilation) {
    super(ctx, 'node-builder');
  }

  public build(): any {
    // TODO(indutny): types
    const root = this.ctx.stageResults['node-translator'].root;
    return {
      entry: root.build(this.ctx, this.nodes),
      map: this.nodes
    };
  }
}
