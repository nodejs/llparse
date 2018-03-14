import * as assert from 'assert';
import { Signature } from './code';
import { Field } from './field';

export class FieldValue extends Field {
  constructor(signature: Signature, name: string, field: string,
              public readonly value: number) {
    super(signature, name, field);

    assert.strictEqual(value, value | 0,
      '`value` argument of FieldValue must be an integer');
  }
}
