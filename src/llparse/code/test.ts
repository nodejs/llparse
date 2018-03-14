import { FieldValue } from './field-value';

export class Test extends FieldValue {
  constructor(field: string, mask: number) {
    super('match', 'test', field, mask);
  }
}
