import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

export class Int extends Node<frontend.node.Int> {
  public doBuild(out: string[]): void {

  }
}
