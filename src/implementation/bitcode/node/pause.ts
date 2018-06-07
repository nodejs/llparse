import * as frontend from 'llparse-frontend';

import { IRBasicBlock } from '../compilation';
import { CONTAINER_KEY } from '../constants';
import { Node, INodePosition } from './base';
import { Error as ErrorNode } from './error';

export class Pause extends ErrorNode<frontend.node.Pause> {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const ctx = this.compilation;
    bb = this.storeError(bb, pos);

    // Recoverable state
    const otherwise = this.cast(this.ref.otherwise!.node).build(ctx);
    ctx.addResumptionTarget(otherwise);
    bb.store(otherwise, ctx.currentField(bb));

    const retType = bb.parent.ty.toSignature().returnType;
    bb.ret(retType.val(null));
  }
}
