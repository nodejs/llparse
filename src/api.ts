import { source } from 'llparse-frontend';

import { Compiler, ICompilerOptions, ICompilerResult } from './compiler';

export { source, ICompilerOptions, ICompilerResult };

// TODO(indutny): API for disabling/short-circuiting spans

/**
 * LLParse graph builder and compiler.
 */
export class LLParse extends source.Builder {
  private readonly prefix: string;

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
  constructor(prefix: string = 'llparse') {
    super();
    this.prefix = prefix;
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
