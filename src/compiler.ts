import { Buffer } from 'buffer';
import {
  Builder,
  LoopChecker,
  node as apiNode,
  Property as APIProperty,
} from 'llparse-builder';

import { Compilation } from './compilation';
import { SpanAllocator } from './span-allocator';
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
  constructor(private readonly prefix: string,
              private readonly options: ICompilerOptions) {
  }

  public compile(apiRoot: apiNode.Node,
                 properties: ReadonlyArray<APIProperty>): ICompilerResult {
    // Check if loops are present
    const lc = new LoopChecker();
    lc.check(apiRoot);

    // Allocate spans
    const sa = new SpanAllocator();
    const spans = sa.allocate(apiRoot);

    // Translate to compiler nodes
    const t = new Translator(this.prefix);
    const root = t.translate(apiRoot);

    // Compile to bitcode
    const compilation = new Compilation(this.prefix, root, properties,
      this.options);
    const bitcode = compilation.buildBitcode();
    const headers = compilation.buildHeaders();

    return { bitcode, headers };
  }

  // Convenience

  public createBuilder(): Builder {
    return new Builder();
  }
}
