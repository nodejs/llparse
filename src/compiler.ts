import { Builder } from 'llparse-builder';

export class Compiler {
  public createBuilder(): Builder {
    return new Builder();
  }
}
