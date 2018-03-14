export { Code } from './code';

export class Match extends Code {
  constructor(name: string) {
    super('match', name);
  }
}
