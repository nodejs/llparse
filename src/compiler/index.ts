import * as debugAPI from 'debug';
import * as frontend from 'llparse-frontend';

import source = frontend.source;

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
  readonly header: string;
}

interface IWritableCompilerResult {
  bitcode?: Buffer;
  header: string;
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

    debug('Building header');
    const hb = new HeaderBuilder();

    const header = hb.build({
      prefix: this.prefix,
      headerGuard: this.options.headerGuard,
      properties: properties,
      spans: info.spans,
    });

    let result: IWritableCompilerResult = {
      header,
      bitcode: undefined,
    };
    if (bitcode) {
      result.bitcode = bitcode.compile(info);
    }

    return result;
  }
}
