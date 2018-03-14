import * as node from '../node';
import { Buffer } from 'buffer';

export interface ICaseLinearizeResult {
  key: Buffer;
  next: node.Node;
  value: number | undefined;
  noAdvance: boolean;
}

export abstract class Case {
  constructor(public readonly type: string, public readonly next: node.Node) {
  }

  public abstract linearize(): ICaseLinearizeResult[];
}
