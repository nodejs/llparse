export type Signature = 'match' | 'value';

export abstract class Code {
  constructor(public readonly signature: Signature,
              public readonly name: string) {
  }
}
