import { transform } from '../internal';

export class TransformAPI {
  public toLowerUnsafe(): transform.Transform {
    return new transform.Transform('to_lower_unsafe');
  }
}
