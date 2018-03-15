import { Buffer } from 'buffer';
import {
  Builder,
  node as apiNode,
  Property as APIProperty,
} from 'llparse-builder';

import { Compilation } from './compilation';
import { Translator } from './translator';

export { Builder };

export interface ICompilerOptions {
  // Debug method name, if present
  debug?: string;
}

export interface ICompilerResult {
  readonly bitcode: Buffer;
  readonly headers: string;
}

export class Compiler {
  constructor(private readonly options: ICompilerOptions) {
  }

  public compile(apiRoot: apiNode.Node,
                 properties: ReadonlyArray<APIProperty>): ICompilerResult {
    const t = new Translator();

    const root = t.translate(apiRoot);
    const compilation = new Compilation(root, properties, this.options);

    const bitcode = compilation.buildBitcode();
    const headers = compilation.buildHeaders();
    return { bitcode, headers };
  }

  // Convenience

  public createBuilder(): Builder {
    return new Builder();
  }
}
