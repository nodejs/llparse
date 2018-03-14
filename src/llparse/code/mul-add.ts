import * as assert from 'assert';

import { Field } from './field';

export interface IMulAddOptions {
  base: number;
  max?: number;
  signed?: boolean;
}

export interface IMulAddCompleteOptions {
  base: number;
  max: number;
  signed: boolean;
}

export class MulAdd extends Field {
  public readonly options: IMulAddCompleteOptions;

  constructor(field: string, options: IMulAddOptions) {
    super('value', 'mul_add', field);

    const complete: IMulAddCompleteOptions = {
      base: options.base,
      max: options.max === undefined ? 0 : options.max,
      signed: options.signed === undefined ? true : options.signed,
    };

    assert(complete.max >= 0,
      '`MulAdd.options.max` must be a non-negative number');
    assert(complete.base > 0,
      '`MulAdd.options.base` must be a positive number');
    assert.strictEqual(complete.max, complete.max | 0,
      '`MulAdd.options.max` must be an integer');
    assert.strictEqual(complete.base, complete.base | 0,
      '`MulAdd.options.max` must be an integer');

    this.options = complete;
  }
}
