import * as debugAPI from 'debug';
import * as frontend from 'llparse-frontend';

import source = frontend.source;

import * as bitcodeImpl from '../implementation/bitcode';
import * as cImpl from '../implementation/c';
import * as jsImpl from '../implementation/js';
import { HeaderBuilder } from './header-builder';
import { StructStateFieldsBuilder } from './struct-state-fields-builder';

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

  /** Generate C (`true` by default) */
  readonly generateC?: boolean;

  /** Generate JS (`true` by default) */
  readonly generateJS?: boolean;

  /** Optional frontend configuration */
  readonly frontend?: frontend.IFrontendLazyOptions;

  /** Optional C-backend configuration */
  readonly c?: cImpl.ICPublicOptions;

  /** Optional JS-backend configuration */
  readonly js?: jsImpl.IJSPublicOptions;
}

export interface ICompilerResult {
  /**
   * Binary LLVM bitcode, if `generateBitcode` option was `true`
   */
  readonly bitcode?: Buffer;

  /**
   * Textual C code, if `generateC` option was `true`
   */
  readonly c?: string;

  /**
   * Textual JS code, if `generateJS` option was `true`
   */
  readonly js?: string;

  /**
   * Textual C header file
   */
  readonly header: string;
}

interface IWritableCompilerResult {
  bitcode?: Buffer;
  c?: string;
  js?: string;
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

    let c: cImpl.CCompiler | undefined;
    if (this.options.generateC !== false) {
      c = new cImpl.CCompiler(container, Object.assign({
        debug: this.options.debug,
      }, this.options.c));
    }

    let js: jsImpl.JSCompiler | undefined;
    if (this.options.generateJS !== false) {
      js = new jsImpl.JSCompiler(container, Object.assign({
        debug: this.options.debug,
      }, this.options.js!));
    }

    debug('Running frontend pass');
    const f = new frontend.Frontend(this.prefix,
                                    container.build(),
                                    this.options.frontend);
    const info = f.compile(root, properties);

    debug('Building fields for state struct');
    const fields = new StructStateFieldsBuilder().build(info);

    debug('Building header');
    const header = new HeaderBuilder().build(this.options.headerGuard,
                                             fields,
                                             info);

    const result: IWritableCompilerResult = {
      bitcode: undefined,
      header,
    };

    debug('Building bitcode');
    if (bitcode) {
      result.bitcode = bitcode.compile(fields, info);
    }

    debug('Building C');
    if (c) {
      result.c = c.compile(info);
    }

    debug('Building JS');
    if (js) {
      result.js = js.compile(info);
    }

    return result;
  }
}
