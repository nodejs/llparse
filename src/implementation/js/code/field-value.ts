import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export abstract class FieldValue<T extends frontend.code.FieldValue> extends Field<T> {
  protected value(ctx: Compilation): string {
    let res = this.ref.value.toString();
    if (ctx.getFieldType(this.ref.field) === 'i64') {
      res += 'n';
    }
    return res;
  }
}
