import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

export class Pause extends Node<frontend.node.Pause> {
  public doBuild(out: string[]): void {
  }
}
