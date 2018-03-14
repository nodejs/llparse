import { Compilation, BasicBlock, INodeID } from '../compilation';
import { Node, INodeChild } from './base';
import { Error } from './error';

export class Pause extends Error {
  constructor(id: INodeID, code: number, reason: string) {
    super(id, code, reason);
  }

  public getResumptionTargets(): ReadonlyArray<Node> {
    return super.getResumptionTargets().concat(this.otherwise);
  }

  protected doBuild(ctx: Compilation, body: BasicBlock): void {
    body = this.buildStoreError(ctx, body);

    const currentPtr = ctx.stateField(body, '_current');

    // Recoverable state
    const target = this.buildNode(ctx, this.otherwise);
    body.store(target, currentPtr);

    body.ret(ctx.fn.ty.toSignature().returnType.val(null));
  }
}
