import { Code } from '../code';
import { Compilation, BasicBlock, INodeID } from '../compilation';
import { Node, INodeChild } from './base';

export class SpanStart extends Node {
  constructor(id: INodeID, private readonly code: Code) {
    super('span-start', id);

    this.privNoPrologueCheck = true;
  }

  public getResumptionTargets(): ReadonlyArray<INodeChild> {
    return super.getResumptionTargets().concat(this.otherwise);
  }

  protected doBuild(ctx: Compilation, body: BasicBlock): void {
    body = ctx.compilation.stageResults['span-builder'].spanStart(
      ctx.fn, body, this.code);
    this.doOtherwise(ctx, body);
  }
}
