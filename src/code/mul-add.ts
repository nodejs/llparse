import { Compilation, IRBasicBlock } from '../compilation';
import { toCacheKey } from '../utils';
import { Field } from './field';

export interface IMulAddOptions {
  readonly base: number;
  readonly max?: number;
  readonly signed?: boolean;
}

function toOptionsKey(options: IMulAddOptions): string {
  let res = `base_${toCacheKey(options.base)}`;
  if (options.max !== undefined) {
    res += `_max_${toCacheKey(options.max)}`;
  }
  if (options.signed !== undefined) {
    res += `_signed_${toCacheKey(options.signed)}`;
  }
  return res;
}

export class MulAdd extends Field {
  constructor(name: string, field: string,
              private readonly options: IMulAddOptions) {
    super('value', `mul_add_${field}_${toOptionsKey(options)}`, name, field);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
