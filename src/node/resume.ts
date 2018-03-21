import { IRBasicBlock } from '../compilation';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';

export class Resume extends Node {
  constructor(id: IUniqueName, private readonly code: number) {
    super(id);
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const ctx = this.compilation;
    const retType = bb.parent.ty.toSignature().returnType;

    const error = bb.load(ctx.errorField(bb));
    const cmp = bb.icmp('eq', error, error.ty.toInt().val(this.code));
    const { onTrue: stillPause, onFalse: resume } = ctx.branch(bb, cmp);

    stillPause.name = 'still_pause';
    stillPause.ret(retType.val(null));

    resume.name = 'resume';
    this.tailTo(resume, this.otherwise!, pos);
  }
}
