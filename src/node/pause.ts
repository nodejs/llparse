import { IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { INodePosition } from './base';
import { Error as ErrorNode } from './error';

export class Pause extends ErrorNode {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const ctx = this.compilation;
    bb = this.storeError(bb, pos);

    // Recoverable state
    const target = this.otherwise!.node.build(ctx);
    ctx.addResumptionTarget(target);
    bb.store(target, ctx.currentField(bb));

    const retType = bb.parent.ty.toSignature().returnType;
    bb.ret(retType.val(null));
  }
}
