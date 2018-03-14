import { Compilation } from '../compilation';
import { Code, Func } from './base';

class Test extends Code {
  constructor(name: string, private readonly field: string,
              private readonly value: string) {
    super('test', 'match', name);

    this.privCacheKey = `test_${this.field}_${this.numKey(this.value)}`;
  }

  build(ctx: Compilation, fn: Func): void {
    const body = fn.body;
    const field = this.field;
    const value = this.value;

    const { fieldType, returnType } = this.getTypes(ctx, fn, field);

    const current = ctx.load(fn, body, field);

    const masked = body.binop('and', current, fieldType.val(value));
    const bool = body.icmp('eq', masked, fieldType.val(value));

    body.ret(ctx.truncate(body, bool, returnType));
  }
}
