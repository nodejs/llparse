import { Compilation } from '../compilation';
import { Code, Func } from './base';

class Update extends Code {
  constructor(name: string, private readonly field: string,
              private readonly value: number) {
    super('update', 'match', name);

    this.privCacheKey = `update_${this.field}_${this.numKey(this.value)}`;
  }

  public build(ctx: Compilation, fn: Func): void {
    const body = fn.body;
    const field = this.field;
    const value = this.value;

    const { fieldType, returnType } = this.getTypes(ctx, fn, field);

    ctx.store(fn, body, field, fieldType.val(value));
    body.ret(returnType.val(0));
  }
}
