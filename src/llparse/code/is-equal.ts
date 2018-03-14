import { FieldValue } from './field-value';

export class IsEqual extends FieldValue {
  constructor(field: string, value: number) {
    super('match', 'is_equal', field, value);
  }
}
