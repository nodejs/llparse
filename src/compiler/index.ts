import * as debugAPI from 'debug';
import * as source from 'llparse-builder';
import * as frontend from 'llparse-frontend';

import * as bitcodeImpl from '../implementation/bitcode';
import { HeaderBuilder } from './header-builder';

const debug = debugAPI('llparse:compiler');

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

  /**
   * What guard define to use in `#ifndef` in C headers.
   *
   * Default value: `prefix` argument
   */
  readonly headerGuard?: string;

  /** Generate bitcode (`true` by default) */
  readonly generateBitcode?: boolean;

  /** Optional frontend configuration */
  readonly frontend?: frontend.IFrontendLazyOptions;
}

export interface ICompilerResult {
  /**
   * Binary LLVM bitcode, if `generateBitcode` option was `true`
   */
  readonly bitcode?: Buffer;

  /**
   * Textual C header file
   */
  readonly headers: string;
}

interface IWritableCompilerResult {
  bitcode?: Buffer;
  headers: string;
}

export class Compiler {
  constructor(public readonly prefix: string,
              public readonly options: ICompilerOptions) {
  }

  public compile(root: source.node.Node,
                 properties: ReadonlyArray<source.Property>): ICompilerResult {
    debug('Combining implementations');
    const container = new frontend.Container();

    let bitcode: bitcodeImpl.BitcodeCompiler | undefined;
    if (this.options.generateBitcode !== false) {
      bitcode = new bitcodeImpl.BitcodeCompiler(container, {
        debug: this.options.debug,
      });
    }

    debug('Running frontend pass');
    const f = new frontend.Frontend(this.prefix,
                                    container.build(),
                                    this.options.frontend);
    const info = f.compile(root, properties);

    debug('Building headers');
    const hb = new HeaderBuilder();

    const headers = hb.build({
      prefix: this.prefix,
      headerGuard: this.options.headerGuard,
      properties: properties,
      spans: info.spans,
    });

    let result: IWritableCompilerResult = { headers };
    if (bitcode) {
      result.bitcode = bitcode.compile(info);
    }

    return result;
  }
}
