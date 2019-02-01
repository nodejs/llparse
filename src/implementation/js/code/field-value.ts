import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Field } from './field';

export abstract class FieldValue<T extends frontend.code.FieldValue> extends Field<T> {
  protected value(ctx: Compilation): string {
    return this.ref.value.toString();
  }
}
