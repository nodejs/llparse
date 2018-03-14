import { Code } from '../code';
import { Compilation, BasicBlock, INodeID } from '../compilation';
import { Node, INodeChild } from './base';

export class SpanEnd extends Node {
  constructor(id: INodeID, private readonly code: Code) {
    super('span-end', id);

    this.privNoPrologueCheck = true;
  }

  public getResumptionTargets(): ReadonlyArray<INodeChild> {
    return super.getResumptionTargets().concat(this.otherwise);
  }

  protected doBuild(ctx: Compilation, body: BasicBlock): void {
    const result = ctx.compilation.stageResults['span-builder'].spanEnd(
      ctx.fn, body, this.code);

    result.updateResumptionTarget(this.doOtherwise(ctx, result.body));
  }
}
