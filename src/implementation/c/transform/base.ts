import * as frontend from 'llparse-frontend';

export abstract class Transform<T extends frontend.transform.Transform> {
  constructor(public readonly ref: T) {
  }
}
