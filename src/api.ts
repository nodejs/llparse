import { Builder, node } from 'llparse-builder';

import { Compiler, ICompilerOptions, ICompilerResult } from './compiler';

export { node };

export class LLParse extends Builder {
  constructor(private readonly prefix: string = 'llparse') {
    super();
  }

  public build(root: node.Node, options: ICompilerOptions = {})
    : ICompilerResult {
    const c = new Compiler(this.prefix, options);

    return c.compile(root, this.properties);
  }
}
