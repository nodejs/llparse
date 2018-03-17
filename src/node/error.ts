import { IRBasicBlock } from '../compilation';
import { GEP_OFF } from '../constants';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';

class ErrorNode extends Node {
  constructor(id: IUniqueName, private readonly code: number,
              private readonly reason: string) {
    super(id);
  }

  protected storeError(bb: IRBasicBlock, pos: INodePosition): IRBasicBlock {
    const ctx = this.compilation;
    const reason = ctx.cstring(this.reason);

    const cast = bb.getelementptr(reason, GEP_OFF.val(0), GEP_OFF.val(0),
      true);

    const errorField = ctx.errorField(bb);
    bb.store(errorField.ty.toPointer().to.val(this.code), errorField);
    bb.store(cast, ctx.reasonField(bb));
    bb.store(pos.current, ctx.errorPosField(bb));

    return bb;
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    bb = this.storeError(bb, pos);

    // Non-recoverable state
    const currentField = this.compilation.currentField(bb);
    bb.store(currentField.ty.toPointer().to.val(null), currentField);

    const retType = bb.parent.ty.toSignature().returnType;
    bb.ret(retType.val(null));
  }
}

export { ErrorNode as Error };
