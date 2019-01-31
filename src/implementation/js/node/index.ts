import * as frontend from 'llparse-frontend';

import { Consume } from './consume';
import { Empty } from './empty';
import { Error as ErrorNode } from './error';
import { Invoke } from './invoke';
import { Pause } from './pause';
import { Sequence } from './sequence';
import { Single } from './single';
import { SpanEnd } from './span-end';
import { SpanStart } from './span-start';
import { TableLookup } from './table-lookup';

export { Node } from './base';

export default {
  Consume,
  Empty,
  Error: class Error extends ErrorNode<frontend.node.Error> {},
  Invoke,
  Pause,
  Sequence,
  Single,
  SpanEnd,
  SpanStart,
  TableLookup,
};
