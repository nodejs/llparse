import { code } from '../llparse';

export class CodeAPI {
  // TODO(indutny): should we allow custom bodies here?
  match(name: string): code.Match {
    return new code.Match(name);
  }

  // TODO(indutny): should we allow custom bodies here?
  value(name: string): code.Value {
    return new code.Value(name);
  }

  span(name: string): code.Span {
    return new code.Span(name);
  }

  // Helpers

  store(field: string): code.Store {
    return new code.Store(field);
  }

  load(field: string): code.Load {
    return new code.Load(field);
  }

  mulAdd(field: string, options: code.IMulAddOptions): code.MulAdd {
    return new code.MulAdd(field, options);
  }

  update(field: string, value: number): code.Update {
    return new code.Update(field, value);
  }

  isEqual(field: string, value: number): code.IsEqual {
    return new code.IsEqual(field, value);
  }

  or(field: string, value: number): code.Or {
    return new code.Or(field, value);
  }

  test(field: string, value: number): code.Test {
    return new code.Test(field, value);
  }
}
