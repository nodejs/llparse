import { Compilation } from '../compilation';
import {
  ARG_ENDPOS, ARG_POS, ARG_STATE,
  ATTR_ENDPOS, ATTR_POS, ATTR_STATE,
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

    fn.body.ret(TYPE_ERROR.val(0));
  }
}
