import { Field } from './field';

export class Store extends Field {
  constructor(field: string) {
    super('value', 'store', field);
  }
}
