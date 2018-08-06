import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Error as ErrorNode } from './error';

export class Pause extends ErrorNode<frontend.node.Pause> {
  public doBuild(out: string[]): void {
  }
}
