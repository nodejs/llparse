import * as frontend from 'llparse-frontend';

import { Compilation, IRBasicBlock } from '../compilation';
import { Field } from './field';

export class Load extends Field<frontend.code.Load> {
  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const result = bb.load(ctx.stateField(bb, this.ref.field));
    bb.ret(ctx.truncate(bb, result, bb.parent.ty.toSignature().returnType));
  }
}
