import { Compilation, IRBasicBlock } from '../compilation';
import { Transform } from '../transform';
import { Node } from './base';

export abstract class Match extends Node {
  protected transform: Transform | undefined;

  public setTransform(transform: Transform): void {
    this.transform = transform;
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    // TODO(indutny): implement me
  }
}
