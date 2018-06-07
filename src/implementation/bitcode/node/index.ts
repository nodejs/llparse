import * as frontend from 'llparse-frontend';

import { Consume } from './consume';
import { Empty } from './empty';
import { Error as ErrorNode } from './error';
import { Invoke } from './invoke';
import { Pause } from './pause';
import { Sequence } from './sequence';
import { Single } from './single';
import { SpanEnd } from './span-end';

export * from './base';

export default {
  Consume,
  Empty,
  Error: class Error extends ErrorNode<frontend.node.Error> {},
  Invoke,
  Pause,
  // TODO(indutny): enable me, after implementing match-sequence
  // Sequence,
  Single,
  SpanEnd,
};
