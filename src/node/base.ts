import { IUniqueName } from '../utils';

export interface INodeOtherwise {
  readonly target: Node;
  readonly noAdvance: boolean;
}

export abstract class Node {
  private privOtherwise: INodeOtherwise | undefined;

  constructor(public readonly id: IUniqueName) {
  }

  public get otherwise(): INodeOtherwise | undefined {
    return this.privOtherwise;
  }

  public setOtherwise(target: Node, noAdvance: boolean) {
    this.privOtherwise = { target, noAdvance };
  }
}
