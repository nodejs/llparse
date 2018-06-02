import { Buffer } from 'buffer';
import * as debugAPI from 'debug';
import {
  Builder,
  LoopChecker,
  node as apiNode,
  Property as APIProperty,
  SpanAllocator,
} from 'llparse-builder';
import * as builder from 'llparse-builder';

import { Compilation } from '../compilation';
import { ITranslatorLazyOptions, Translator } from '../translator';
import { ExecuteBuilder } from './execute-builder';
import { InitBuilder } from './init-builder';

const debug = debugAPI('llparse:compiler');

export { builder, Builder };

export interface ICompilerOptions {
   /**
    * Debug method name
    *
    * The method must have following signature:
    *
    * ```c
    * void debug(llparse_t* state, const char* p, const char* endp,
    *            const char* msg);
    * ```
    *
    * Where `llparse_t` is a parser state type.
    */
  readonly debug?: string;

  /** Translator options */
  readonly translator?: ITranslatorLazyOptions;

  /** What guard define to use in `#ifndef` in C headers */
  readonly headerGuard?: string;
}

/** Build artifacts */
export interface ICompilerResult {
  /** Bitcode output */
  readonly bitcode: Buffer;

  /** C header */
  readonly header: string;
}

export class Compiler {
  constructor(private readonly prefix: string,
              private readonly options: ICompilerOptions) {
  }

  public compile(apiRoot: apiNode.Node,
                 properties: ReadonlyArray<APIProperty>): ICompilerResult {
    // Check if loops are present
    debug('checking loops');
    const lc = new LoopChecker();
    lc.check(apiRoot);

    // Allocate spans
    debug('allocating spans');
    const sa = new SpanAllocator();
    const spans = sa.allocate(apiRoot);

    // Translate to compiler nodes
    debug('translating nodes');
    const t = new Translator(this.prefix, this.options.translator || {}, spans);
    const root = t.translate(apiRoot);

    // Compile to bitcode
    const compilation = new Compilation(this.prefix, root, properties, t.spans,
      this.options);

    debug('building root');
    const initFn = root.build(compilation);
    compilation.addResumptionTarget(initFn);

    debug('building init');
    const ib = new InitBuilder();
    ib.build(compilation, initFn);

    debug('building execute');
    const eb = new ExecuteBuilder();
    eb.build(compilation, t.spans);

    debug('building bitcode');
    const bitcode = compilation.buildBitcode(initFn);

    debug('building header');
    const header = compilation.buildHeader();

    debug('done');
    return { bitcode, header };
  }

  // Convenience

  public createBuilder(): Builder {
    return new Builder();
  }
}
