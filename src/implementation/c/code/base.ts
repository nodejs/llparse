import * as frontend from 'llparse-frontend';

export abstract class Code<T extends frontend.code.Code> {
  constructor(public readonly ref: T) {
  }
}
