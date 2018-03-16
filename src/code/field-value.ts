import { Signature } from './base';
import { Field } from './field';

export abstract class FieldValue extends Field {
  constructor(signature: Signature, name: string, field: string,
              private readonly value: number) {
    super(signature, name, field);
  }
}
