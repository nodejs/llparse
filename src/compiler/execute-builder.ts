import { Compilation, IRBasicBlock, IRValue } from '../compilation';
import {
  ARG_ENDPOS, ARG_POS, ARG_STATE,
  ATTR_ENDPOS, ATTR_POS, ATTR_STATE,
  CCONV,
  GEP_OFF,
  TYPE_ENDPOS, TYPE_ERROR, TYPE_POS,
} from '../constants';
import { Span } from '../span';

export class ExecuteBuilder {
  public build(ctx: Compilation, spans: ReadonlyArray<Span>): void {
    const sig = ctx.ir.signature(TYPE_ERROR, [
      ctx.state.ptr(), TYPE_POS, TYPE_ENDPOS ]);
    const fn = ctx.defineFunction(sig, `${ctx.prefix}_execute`,
      [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);
    fn.paramAttrs[0].add(ATTR_STATE);
    fn.paramAttrs[1].add(ATTR_POS);
    fn.paramAttrs[2].add(ATTR_ENDPOS);

    fn.linkage = 'external';

    const bb = this.restartSpans(ctx, spans, fn.body);

    const current = bb.load(ctx.currentField(bb));
    const call = bb.call(current, [
      ctx.stateArg(bb),
      ctx.posArg(bb),
      ctx.endPosArg(bb),
      current.ty.toPointer().to.toSignature().params[3].undef(),
    ], 'normal', CCONV);

    const callees = ctx.getResumptionTargets().map((target) => {
      return ctx.ir.metadata(target);
    });
    call.metadata.set('callees', ctx.ir.metadata(callees));

    const cmp = bb.icmp('ne', call, call.ty.toPointer().val(null));
    const { onTrue: success, onFalse: error } = ctx.branch(bb, cmp, {
      onFalse: 'unlikely',
      onTrue: 'likely',
    });

    success.name = 'success';

    const bitcast = success.cast('bitcast', call, current.ty);
    success.store(bitcast, ctx.currentField(success));

    this.executeSpans(ctx, spans, success).ret(TYPE_ERROR.val(0));

    error.name = 'error';

    error.ret(error.load(ctx.errorField(error)));
  }

  private restartSpans(ctx: Compilation, spans: ReadonlyArray<Span>,
                       bb: IRBasicBlock): IRBasicBlock {
    spans.forEach((span) => {
      const startPtr = ctx.spanPosField(bb, span.index);
      const start = bb.load(startPtr);

      const cmp = bb.icmp('eq', start, start.ty.toPointer().val(null));
      const { onTrue: empty, onFalse: restart } = ctx.branch(bb, cmp);
      empty.name = 'span_empty_' + span.index;
      restart.name = 'span_restart_' + span.index;

      restart.store(ctx.posArg(bb), startPtr);

      // Join
      restart.jmp(empty);
      bb = empty;
    });
    return bb;
  }

  private executeSpans(ctx: Compilation, spans: ReadonlyArray<Span>,
                       bb: IRBasicBlock): IRBasicBlock {
    spans.forEach((span) => {
      const start = bb.load(ctx.spanPosField(bb, span.index));

      const cmp = bb.icmp('ne', start, start.ty.toPointer().val(null));
      const { onTrue: present, onFalse: empty } = ctx.branch(bb, cmp);
      present.name = 'span_present_' + span.index;
      empty.name = 'span_empty_' + span.index;

      let cb;
      if (span.callbacks.length === 1) {
        cb = span.callbacks[0].build(ctx);
      } else {
        cb = present.load(ctx.spanCbField(present, span.index));
      }

      // TODO(indutny): this won't work with internal callbacks due to
      // cconv mismatch in indirect call
      const call = present.call(cb, [
        ctx.stateArg(present),
        start,
        ctx.endPosArg(present),
      ]);
      if (span.callbacks.length > 1) {
        const callees = span.callbacks.map((callback) => {
          return ctx.ir.metadata(callback.build(ctx));
        });
        call.metadata.set('callees', ctx.ir.metadata(callees));
      }

      // Check return value
      const errorCmp = present.icmp('eq', call, call.ty.toInt().val(0));

      const { onTrue: noError, onFalse: error } = ctx.branch(
        present, errorCmp, { onTrue: 'likely', onFalse: 'unlikely' });
      noError.name = 'span_no_error_' + span.index;
      error.name = 'span_error_' + span.index;

      this.buildError(ctx, error, call);
      error.ret(call);

      noError.jmp(empty);
      bb = empty;
    });

    return bb;
  }

  // TODO(indutny): de-duplicate this here and in SpanEnd
  private buildError(ctx: Compilation, bb: IRBasicBlock, code: IRValue): void {
    const reason = ctx.cstring('Span callback error');
    const cast = bb.getelementptr(reason, GEP_OFF.val(0), GEP_OFF.val(0), true);

    bb.store(code, ctx.errorField(bb));
    bb.store(cast, ctx.reasonField(bb));
    bb.store(ctx.endPosArg(bb), ctx.errorPosField(bb));
  }
}
