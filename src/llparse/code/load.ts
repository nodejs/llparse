import { Field } from './field';

export class Load extends Field {
  constructor(field: string) {
    super('match', 'load', field);
  }
}
