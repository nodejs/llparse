import { Compilation } from '../compilation';
import { Code, Func } from './base';

class IsEqual extends Code {
  constructor(name: string, private readonly field: string,
              private readonly value: number) {
    super('is-equal', 'match', name);

    this.privCacheKey = `is_equal_${this.field}_${this.numKey(this.value)}`;
  }

  public build(ctx: Compilation, fn: Func): void {
    const body = fn.body;
    const field = this.field;
    const value = this.value;

    const { fieldType, returnType } = this.getTypes(ctx, fn, field);
    const fieldValue = ctx.load(fn, body, field);

    const cmp = body.icmp('eq', fieldValue, fieldType.val(value));
    body.ret(ctx.truncate(body, cmp, returnType));
  }
}
