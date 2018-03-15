import { IUniqueName } from '../utils';
import { Node } from './base';

export class Consume extends Node {
  constructor(id: IUniqueName, private readonly field: string) {
    super(id);
  }
}
