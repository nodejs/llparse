import { Compilation } from '../compilation';
import { Node } from '../node';
import { Stage } from './base';

interface IQueueElem {
  node: Node;
  key: number | Buffer | undefined;
}

export class NodeLoopChecker extends Stage {
  private readonly reachableMap<Node, Set<Node> > = new Map();

  constructor(ctx: Compilation) {
    super(ctx, 'node-loop-checker');
  }

  public build(): any {
    const queue: IQueueElem = [ {
      node: this.ctx.stageResults['node-translator'].root,
      key: undefined
    } ];

    while (queue.length !== 0) {
      const item = queue.pop();
      const lastKey = item.key;
      const node = item.node;

      let children = node.getChildren();

      // Loops like:
      //
      // `nodeA: peek(A)` => `nodeB: match(A), otherwise -> nodeA`
      //
      // should pass the check
      if (typeof lastKey === 'number') {
        // Remove all unreachable clauses
        children = children.filter((child) => {
          return child.key === undefined || child.key === lastKey;
        });

        // See if there is a matching peek clause
        const sameKey = children.some((child) => {
          return child.key === lastKey && !child.noAdvance;
        });
        if (sameKey)
          return;
      }

      children = children.filter(child => child.noAdvance);

      children.forEach((child) => {
        if (this.addEdge(node, child.node)) {
          queue.push({ node: child.node, key: child.key || lastKey });
        }
      });
    }

    return true;
  }

  private reachable(from: Node): Set<Node> {
    if (this.reachableMap.has(from)) {
      return this.reachableMap.get(from)!;
    }

    const res = new Set([ from ]);
    this.reachableMap.set(from, res);
    return res;
  }

  private addEdge(from: Node, to: Node): boolean {
    const target = this.reachable(to);

    let changed = false;
    this.reachable(from).forEach((node) => {
      if (to === node) {
        throw new Error(`Loop detected in "${to.sourceName}", ` +
          `through the backedge from "${from.sourceName}"`);
      }

      if (target.has(node))
        return;

      changed = true;
      target.add(node);
    });

    return changed;
  }
}
