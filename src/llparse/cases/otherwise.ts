import * as node from '../node';
import { ICaseLinearizeResult, Case } from './case';

export class Otherwise extends Case {
  constructor(next: node.Node, public readonly skip: boolean = false) {
    super('otherwise', next);
  }

  public linearize(): ICaseLinearizeResult[] {
    throw new Error('Should not be called');
  }
}
