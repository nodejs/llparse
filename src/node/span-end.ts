import * as assert from 'assert';

import { Span as SpanCallback } from '../code';
import { IRBasicBlock, IRValue } from '../compilation';
import { GEP_OFF } from '../constants';
import { Span } from '../span';
import { IUniqueName } from '../utils';
import { INodePosition, Node } from './base';

export class SpanEnd extends Node {
  constructor(id: IUniqueName, private readonly span: Span,
              private readonly callback: SpanCallback) {
    super(id);
  }

  protected doBuild(bb: IRBasicBlock, pos: INodePosition): void {
    const ctx = this.compilation;

    // Load
    const startPtr = ctx.spanPosField(bb, this.span.index);
    const start = bb.load(startPtr);

    // ...and reset
    bb.store(start.ty.toPointer().val(null), startPtr);

    const call = bb.call(this.callback.build(ctx), [
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
  }

  private buildError(bb: IRBasicBlock, pos: INodePosition, code: IRValue): void {
    const ctx = this.compilation;

    const reason = ctx.cstring('Span callback error');
    const cast = bb.getelementptr(reason, GEP_OFF.val(0), GEP_OFF.val(0),
      true);

    const errorField = ctx.errorField(bb);
    bb.store(ctx.truncate(bb, code, errorField.ty), errorField);
    bb.store(cast, ctx.reasonField(bb));

    const otherwise = this.otherwise!;
    bb.store(otherwise.noAdvance ? pos.current : pos.next,
      ctx.errorPosField(bb));

    const resumptionTarget = otherwise.node.build(ctx);
    bb.store(resumptionTarget, ctx.currentField(bb));
    ctx.addResumptionTarget(resumptionTarget);

    bb.ret(bb.parent.ty.toSignature().returnType.toPointer().val(null));
  }
}
