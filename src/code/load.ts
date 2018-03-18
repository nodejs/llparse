import { Compilation, IRBasicBlock } from '../compilation';
import { Field } from './field';

export class Load extends Field {
  constructor(name: string, field: string) {
    super('match', `load_${field}`, name, field);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const result = bb.load(ctx.stateField(bb, this.field));
    bb.ret(ctx.truncate(bb, result, bb.parent.ty.toSignature().returnType));
  }
}
