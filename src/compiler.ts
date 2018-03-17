import { Buffer } from 'buffer';
import {
  Builder,
  LoopChecker,
  node as apiNode,
  Property as APIProperty,
} from 'llparse-builder';

import { Compilation } from './compilation';
import { SpanAllocator } from './span';
import { ITranslatorLazyOptions, Translator } from './translator';

export { Builder };

export interface ICompilerOptions {
  // Debug method name, if present
  readonly debug?: string;

  // Translator options, if present
  readonly translator?: ITranslatorLazyOptions;
}

export interface ICompilerResult {
  readonly bitcode: Buffer;
  readonly header: string;
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
    const t = new Translator(this.prefix, this.options.translator || {}, spans);
    const root = t.translate(apiRoot);

    // Compile to bitcode
    const compilation = new Compilation(this.prefix, root, properties, spans,
      this.options);

    const initFn = root.build(compilation);

    const bitcode = compilation.buildBitcode(initFn);
    const header = compilation.buildHeader();

    return { bitcode, header };
  }

  // Convenience

  public createBuilder(): Builder {
    return new Builder();
  }
}
