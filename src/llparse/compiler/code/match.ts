import { Compilation } from '../compilation';
import { Code, Func } from './base';

class Match extends Code {
  constructor(name: string) {
    super('match', 'match', name);

    this.privIsExternal = true;
    this.privCacheKey = 'external_' + name;
  }

  public build(ctx: Compilation, fn: Func): void {
    throw new Error('External code can\'t be built');
  }
}
