import { Compilation } from '../compilation';
import {
  ARG_ENDPOS, ARG_POS, ARG_STATE,
  ATTR_ENDPOS, ATTR_POS, ATTR_STATE,
  CCONV,
  TYPE_ENDPOS, TYPE_ERROR, TYPE_POS,
} from '../constants';

export class ExecuteBuilder {
  public build(ctx: Compilation): void {
    const sig = ctx.ir.signature(TYPE_ERROR, [
      ctx.state.ptr(), TYPE_POS, TYPE_ENDPOS ]);
    const fn = ctx.defineFunction(sig, `${ctx.prefix}_execute`,
      [ ARG_STATE, ARG_POS, ARG_ENDPOS ]);
    fn.paramAttrs[0].add(ATTR_STATE);
    fn.paramAttrs[1].add(ATTR_POS);
    fn.paramAttrs[2].add(ATTR_ENDPOS);

    fn.linkage = 'external';

    const bb = fn.body;

    // TODO(indutny): re-initialize unfinished spans

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
    if (callees.length !== 0) {
      call.metadata.set('callees', ctx.ir.metadata(callees));
    }

    const cmp = bb.icmp('ne', call, call.ty.toPointer().val(null));
    const { onTrue: success, onFalse: error } = ctx.branch(bb, cmp, {
      onFalse: 'unlikely',
      onTrue: 'likely',
    });

    success.name = 'success';

    const bitcast = success.cast('bitcast', call, current.ty);
    success.store(bitcast, ctx.currentField(success));

    // TODO(indutny): execute unfinished spans
    success.ret(TYPE_ERROR.val(0));

    error.name = 'error';

    error.ret(error.load(ctx.errorField(error)));
  }
}
