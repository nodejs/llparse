import * as assert from 'assert';

import { Case, Match, Peek, Select } from '../cases';
import { Transform } from '../transform';
import { Invoke } from './invoke';
import { Node } from './node';

export class Match extends Node {
  private privTransform: Transform | undefined;
  private privCases: Case[] = [];

  constructor(name: string) {
    super(name, 'match');
  }

  public getTransform(): Transform | undefined {
    return this.privTransform;
  }

  public get cases(): ReadonlyArray<Case> {
    return this.privCases;
  }

  public transform(t: Transform): this {
    assert.strictEqual(this.privTransform, undefined,
      'Can\'t apply transform twice');

    this.privTransform = t;
    return this;
  }

  public peek(value: string | ReadonlyArray<string>, next: Node): this {
    // .peek([ ... ], next)
    if (Array.isArray(value)) {
      value.forEach(value => this.peek(value, next));
      return this;
    }

    this.checkIsMatch(next, '.peek()');

    this.privCases.push(new Peek(value, next));

    return this;
  }

  public match(value: string | ReadonlyArray<string>, next: Node): this {
    // .match([ ... ], next)
    if (Array.isArray(value)) {
      value.forEach(value => this.match(value, next));
      return this;
    }

    this.checkIsMatch(next, '.match()');

    this.privCases.push(new Match(value, next));

    return this;
  }

  public select(key: Buffer | number | string | { [key: string] : number },
                value: Invoke | number, next?: Invoke): this {
    // .select(key, value, next)
    const pairs: { key: string, value: number }[] = [];

    if (Buffer.isBuffer(key) || typeof key === 'number' ||
        typeof key === 'string') {
      assert.strictEqual(typeof value, 'number',
        '`.select(key, value, next)` is the signature of the method');

      pairs.push({ key, value });
    } else {
      assert(value instanceof Invoke,
        '`.select(map, next)` is the signature of the method');

      const map = key;
      next = value as Invoke;

      Object.keys(map).forEach((key) => pairs.push({ key, value: map[key]! }));
    }

    assert.strictEqual(next.signature, 'value',
      `Invoke of "${next.name}" can't be a target of \`.select()\``);

    const select = new Select(next);
    pairs.forEach(pair => select.add(pair.key, pair.value));

    this.privCases.push(select);

    return this;
  }
}
