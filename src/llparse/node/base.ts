import * as assert from 'assert';

import * as cases from '../cases';
import * as code from '../code';
import * as node from './';

export abstract class Node {
  private privOtherwise: Node | undefinded;

  constructor(public readonly name: string,
              public readonly signature: code.Signature) {
  }

  public get otherwise(): Node | undefined { return this.privOtherwise; }

  public otherwise(next: Node): this {
    this.checkIsMatch(next, '.otherwise()');

    assert.strictEqual(this.privOtherwise, undefined,
      'Duplicate `.otherwise()`/`.skipTo()`');
    this.privOtherwise = new cases.Otherwise(next);

    return this;
  }

  public skipTo(next: Node): this {
    this.checkIsMatch(next, '.skipTo()');

    assert.strictEqual(this.privOtherwise, undefined,
      'Duplicate `.skipTo()`/`.otherwise()`');
    this.privOtherwise = new cases.Otherwise(next, true);

    return this;
  }

  protected checkIsMatch(next: Node, method: string): void {
    if (!(next instanceof node.Invoke))
      return;

    assert.strictEqual(next.signature, 'match',
      `Invoke of "${next.name}" can't be a target of \`${method}\``);
  }
}
