export interface IUniqueName {
  readonly name: string;
  readonly originalName: string;
}

export class Identifier {
  private readonly ns: Set<string> = new Set();

  constructor(private readonly prefix: string = '',
              private readonly postfix: string = '') {
  }

  public id(name: string): IUniqueName {
    let target = this.prefix + name + this.postfix;
    if (this.ns.has(target)) {
      let i = 1;
      for (; i < this.ns.size; i++) {
        if (!this.ns.has(target + '_' + i)) {
          break;
        }
      }

      target += '_' + i;
    }

    this.ns.add(target);
    return {
      name: target,
      originalName: name,
    };
  }
}
