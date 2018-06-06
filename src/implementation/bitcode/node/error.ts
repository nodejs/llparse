import * as frontend from 'llparse-frontend';

import { IRBasicBlock } from '../compilation';
import { FN_ATTR_ERROR, GEP_OFF } from '../constants';
import { INodePosition, Node } from './base';

class ErrorNode<T extends frontend.node.Error> extends Node<T> {
  protected storeError(bb: IRBasicBlock, pos: INodePosition): IRBasicBlock {
    const ctx = this.compilation;
    const reason = ctx.cstring(this.ref.reason);

    const cast = bb.getelementptr(reason, GEP_OFF.val(0), GEP_OFF.val(0),
      true);

    const errorField = ctx.errorField(bb);
    bb.store(errorField.ty.toPointer().to.val(this.ref.code), errorField);
    bb.store(cast, ctx.reasonField(bb));
    bb.store(pos.current, ctx.errorPosField(bb));

    return bb;
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    bb = this.storeError(bb, pos);

    bb.parent.attrs.add(FN_ATTR_ERROR);

    // Non-recoverable state
    const currentField = this.compilation.currentField(bb);
    bb.store(currentField.ty.toPointer().to.val(null), currentField);

    const retType = bb.parent.ty.toSignature().returnType;
    bb.ret(retType.val(null));
  }
}

export { ErrorNode as Error };
