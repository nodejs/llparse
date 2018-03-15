import { node as apiNode } from 'llparse-builder';
import * as node from './node';

export class Translator {
  public translate(root: apiNode.Node): node.Node {
    return new node.Empty();
  }
}
