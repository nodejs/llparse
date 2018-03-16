import { Field } from './field';

export abstract class FieldValue extends Field {
  constructor(name: string, field: string, private readonly value: number) {
    super(name, field);
  }
}
