import { Buffer } from 'buffer';
import * as debugAPI from 'debug';
import {
  Builder,
  LoopChecker,
  node as apiNode,
  Property as APIProperty,
} from 'llparse-builder';
import * as builder from 'llparse-builder';
import { IFrontendLazyOptions, Frontend } from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from '../node';
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

  /** Frontend options */
  readonly frontend?: IFrontendLazyOptions;

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

    // Translate to compiler nodes
    debug('frontend');
    const f = new Frontend(this.prefix, this.options.frontend);
    const root = t.compile(apiRoot) as Node;

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
