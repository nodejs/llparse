import { Compilation } from '../compilation';
import { Code, Func } from './base';

export class Store extends Code {
  constructor(name: string, private readonly field: string) {
    super('store', 'value', name);

    this.privCacheKey = `store_${this.field}`;
  }

  public build(ctx: Compilation, fn: Func): void {
    const body = fn.body;
    const field = this.field;

    const match = ctx.matchArg(fn);

    const { fieldType, returnType } = this.getTypes(ctx, fn, field);

    const adj = ctx.truncate(body, match, fieldType);

    ctx.store(fn, body, field, adj);
    body.ret(returnType.val(0));
  }
}
