import * as assert from 'assert';
import { Buffer } from 'buffer';

import * as node from '../node';
import * as utils from '../utils';
import { ICaseLinearizeResult, Case } from './case';

export class Select extends Case {
  private readonly privMap: Map<string, number> = new Map();

  constructor(next) {
    super('select', next);
  }

  public get map(): ReadonlyMap<string, number> {
    return this.privMap;
  }

  public add(key, value): void {
    this.privMap.set(key, value);
  }

  public linearize(): ICaseLinearizeResult[] {
    const res: ICaseLinearizeResult = [];

    this.map.forEach((value, key) => {
      const buffer: Buffer = utils.toBuffer(key);
      assert(buffer.length > 0, 'Select must have non-empty argument');

      res.push({
        key: buffer,
        next: this.next,
        value,
        noAdvance: false
      });
    });
    return res;
  }
}
