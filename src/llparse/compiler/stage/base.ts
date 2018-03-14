import { Compilation } from './compilation';

export abstract class Stage {
  constructor(protected readonly ctx: Compilation,
              public readonly name: string) {
  }

  // TODO(indutny): specify types?
  public abstract build(): any;
}
