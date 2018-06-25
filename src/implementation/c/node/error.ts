import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

class ErrorNode extends Node<frontend.node.Error> {
  public doBuild(out: string[]): void {
  }
}

export { ErrorNode as Error };
