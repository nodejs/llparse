import { FieldValue } from './field-value';

export class Update extends FieldValue {
  constructor(field: string, value: number) {
    super('match', 'update', field, value);
  }
}
