import { Code } from './code';

export class Value extends Code {
  constructor(name: string) {
    super('value', name);
  }
}
