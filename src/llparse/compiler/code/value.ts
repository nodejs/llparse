import { Compilation } from '../compilation';
import { Code, Func } from './base';

class Value extends Code {
  constructor(name: string) {
    super('value', 'value', name);

    this.privIsExternal = true;
    this.privCacheKey = 'external_' + name;
  }

  public build(ctx: Compilation, fn: Func): void {
    throw new Error('External code can\'t be built');
  }
}
