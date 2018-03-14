import { Compilation, BasicBlock, INodeID } from '../compilation';
import { Node, INodeChild } from './base';

export class Error extends Node {
  constructor(id: NodeID, private readonly code: number,
              private readonly reason: string) {
    super('error', id);

    this.privNoPrologueCheck = true;
  }

  public getChildren(): ReadonlyArray<INodeChild> {
    return [];
  }

  private buildStoreError(ctx: Compilation, body: BasicBlock): BasicBlock {
    const INT = ctx.INT;

    const reason = ctx.cstring(this.reason);

    const codePtr = ctx.stateField(body, 'error');
    const reasonPtr = ctx.stateField(body, 'reason');
    const posPtr = ctx.stateField(body, 'error_pos');

    const cast = body.getelementptr(reason, INT.val(0), INT.val(0), true);

    body.store(ctx.TYPE_ERROR.val(this.code), codePtr);
    body.store(cast, reasonPtr);
    body.store(ctx.pos.current, posPtr);

    return body;
  }

  protected doBuild(ctx: Compilation, body: BasicBlock): void {
    body = this.buildStoreError(ctx, body);

    const currentPtr = ctx.stateField(body, '_current');

    // Non-recoverable state
    const nodeSig = ctx.compilation.signature.node;
    body.store(nodeSig.ptr().val(null), currentPtr);

    const retType = ctx.fn.ty.toSignature().returnType;
    body.ret(retType.val(null));
  }
}
