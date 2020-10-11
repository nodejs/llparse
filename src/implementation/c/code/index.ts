import * as frontend from 'llparse-frontend';

import { And } from './and';
import { External } from './external';
import { IsEqual } from './is-equal';
import { Load } from './load';
import { MulAdd } from './mul-add';
import { Or } from './or';
import { Store } from './store';
import { Test } from './test';
import { Update } from './update';

export * from './base';

export default {
  And,
  IsEqual,
  Load,
  Match: class Match extends External<frontend.code.External> {},
  MulAdd,
  Or,
  Span: class Span extends External<frontend.code.Span> {},
  Store,
  Test,
  Update,
  Value: class Value extends External<frontend.code.Value> {},
};
