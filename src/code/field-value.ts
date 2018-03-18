import * as assert from 'assert';

import { Signature } from './base';
import { Field } from './field';

export abstract class FieldValue extends Field {
  constructor(signature: Signature, cacheKey: string, name: string,
              field: string, protected readonly value: number) {
    super(signature, cacheKey, name, field);

    assert.strictEqual(value, value | 0, 'FieldValue `value` must be integer');
  }
}
