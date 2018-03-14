import { FieldValue } from './field-value';

export class Or extends code.FieldValue {
  constructor(field: string, value: number) {
    super('match', 'or', field, value);
  }
}
