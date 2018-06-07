import * as frontend from 'llparse-frontend';
import * as assert from 'assert';

import { Code } from '../code';
import { IRBasicBlock, IRValue } from '../compilation';
import { CONTAINER_KEY, GEP_OFF } from '../constants';
import { INodePosition, Node } from './base';

export class SpanEnd extends Node<frontend.node.SpanEnd> {
  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const ctx = this.compilation;

    // Load
    const startPtr = ctx.spanPosField(bb, this.ref.field.index);
    const start = bb.load(startPtr);

    // ...and reset
    bb.store(start.ty.toPointer().val(null), startPtr);

    const callback = ctx.unwrapCode(this.ref.callback);

    const call = bb.call(callback.build(ctx), [
      ctx.stateArg(bb),
      start,
      pos.current,
    ]);

    // Check return value
    const errorCmp = bb.icmp('eq', call, call.ty.toInt().val(0));

    const { onTrue: noError, onFalse: error } = ctx.branch(bb, errorCmp, {
      onFalse: 'unlikely',
      onTrue: 'likely',
    });
    noError.name = 'no_error';
    error.name = 'error';

    // Handle error
    this.buildError(error, pos, call);

    // Otherwise
    this.tailTo(noError, this.ref.otherwise!, pos);
  }

  private buildError(bb: IRBasicBlock, pos: INodePosition, code: IRValue): void {
    const ctx = this.compilation;

    // NOTE: We could print detailed error here, but it would generate
    // inconsistent messages (see `execute` in `compiler/`)
    const reason = ctx.cstring('Span callback error');
    const cast = bb.getelementptr(reason, GEP_OFF.val(0), GEP_OFF.val(0),
      true);

    const errorField = ctx.errorField(bb);
    bb.store(ctx.truncate(bb, code, errorField.ty.toPointer().to), errorField);
    bb.store(cast, ctx.reasonField(bb));

    const otherwise = this.ref.otherwise!;
    bb.store(otherwise.noAdvance ? pos.current : pos.next,
      ctx.errorPosField(bb));

    const resumptionTarget = ctx.unwrapNode(otherwise.node).build(ctx);
    bb.store(resumptionTarget, ctx.currentField(bb));
    ctx.addResumptionTarget(resumptionTarget);

    bb.ret(bb.parent.ty.toSignature().returnType.toPointer().val(null));
  }
}
