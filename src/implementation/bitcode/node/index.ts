import * as frontend from 'llparse-frontend';

import { Consume } from './consume';
import { Empty } from './empty';
import { Error as ErrorNode } from './error';
import { Invoke } from './invoke';
import { Pause } from './pause';

export * from './base';

export default {
  Consume,
  Empty,
  Error: class Error extends ErrorNode<frontend.node.Error> {},
  Invoke,
  Pause,
};
