import * as frontend from 'llparse-frontend';

import source = frontend.source;

import { Compiler, ICompilerOptions, ICompilerResult } from './compiler';

export { source, ICompilerOptions, ICompilerResult };

// TODO(indutny): API for disabling/short-circuiting spans

/**
 * LLParse graph builder and compiler.
 */
export class LLParse extends source.Builder {
  /**
   * The prefix controls the names of methods and state struct in generated
   * public C headers:
   *
   * ```c
   * // state struct
   * struct PREFIX_t {
   *   ...
   * }
   *
   * int PREFIX_init(PREFIX_t* state);
   * int PREFIX_execute(PREFIX_t* state, const char* p, const char* endp);
   * ```
   *
   * @param prefix  Prefix to be used when generating public API.
   */
  constructor(private readonly prefix: string = 'llparse') {
    super();
  }

  /**
   * Compile LLParse graph to the C code and C headers
   *
   * @param root  Root node of the parse graph (see `.node()`)
   * @param options Compiler options.
   */
  public build(root: source.node.Node, options: ICompilerOptions = {})
    : ICompilerResult {
    const c = new Compiler(this.prefix, options);

    return c.compile(root, this.properties);
  }
}
