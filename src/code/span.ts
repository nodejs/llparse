import { External } from './external';

export class Span extends External {
  constructor(name: string) {
    super('span', name);
  }
}
