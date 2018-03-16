import { Code } from './base';

export abstract class Field extends Code {
  constructor(name: string, private readonly field: string) {
    super(name);
  }
}
