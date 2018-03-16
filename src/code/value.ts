import { External } from './external';

export class Value extends External {
  constructor(name: string) {
    super('value', name);
  }
}
