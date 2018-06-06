import * as frontend from 'llparse-frontend';

import { IRBasicBlock } from '../compilation';
import { Node, INodePosition } from './base';
import { Error as ErrorNode } from './error';

export class Pause extends ErrorNode<frontend.node.Pause> {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const ctx = this.compilation;
    bb = this.storeError(bb, pos);

    // Recoverable state
    // TODO(indutny): define a type
    const otherwise = this.ref.otherwise!.node as Node<frontend.node.Node>;
    const target = otherwise.build(ctx);
    ctx.addResumptionTarget(target);
    bb.store(target, ctx.currentField(bb));

    const retType = bb.parent.ty.toSignature().returnType;
    bb.ret(retType.val(null));
  }
}
