import { Compilation } from '../compilation';
import { Code, Func } from './base';

export class Load extends Code {
  constructor(name: string, private readonly field: string) {
    super('load', 'match', name);

    this.privCacheKey = `load_${this.field}`;
  }

  public build(ctx: Compilation, fn: Func): void {
    const body = fn.body;
    const field = this.field;

    const { returnType } = this.getTypes(ctx, fn, field);

    const adj = ctx.truncate(body, ctx.load(fn, body, field), returnType);
    body.ret(adj);
  }
}
