import { Compilation } from '../compilation';
import { Code, Func } from './base';

export class Or extends Code {
  constructor(name, private readonly field: string,
              private readonly value: number) {
    super('or', 'match', name);
    this.privCacheKey = `or_${this.field}_${this.numKey(this.value)}`;
  }

  public build(ctx: Compilation, fn: Func): void {
    const body = fn.body;
    const field = this.field;
    const value = this.value;

    const { fieldType, returnType } = this.getTypes(ctx, fn, field);

    const current = ctx.load(fn, body, field);
    const result = body.binop('or', current, fieldType.val(value));
    ctx.store(fn, body, field, result);
    body.ret(returnType.val(0));
  }
}
