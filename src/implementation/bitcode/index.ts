import { Buffer } from 'buffer';
import * as debugAPI from 'debug';
import * as frontend from 'llparse-frontend';

import { Compilation } from './compilation';
import { CONTAINER_KEY } from './constants';
import code from './code';
import node from './node';
import { Node } from './node';
import transform from './transform';
import { ExecuteBuilder } from './helpers/execute-builder';
import { InitBuilder } from './helpers/init-builder';

const debug = debugAPI('llparse:compiler');

export interface IBitcodeCompilerOptions {
  readonly debug?: string;
}

export class Compiler {
  constructor(container: frontend.Container,
              private readonly options: IBitcodeCompilerOptions) {
    container.add(CONTAINER_KEY, { code, node, transform });
  }

  public compile(info: frontend.IFrontendResult): Buffer {
    // Compile to bitcode
    const compilation = new Compilation(info.prefix, info.properties,
        info.spans, this.options);

    debug('building root');
    const root = info.root as frontend.ContainerWrap<frontend.node.Node>;
    const initFn = root.get<Node<frontend.node.Node>>(CONTAINER_KEY)
        .build(compilation);
    compilation.addResumptionTarget(initFn);

    debug('building match sequence');
    compilation.buildMatchSequence();

    debug('building init');
    const ib = new InitBuilder();
    ib.build(compilation, initFn);

    debug('building execute');
    const eb = new ExecuteBuilder();
    eb.build(compilation, info.spans);

    debug('building bitcode');
    const bitcode = compilation.buildBitcode(initFn);

    debug('done');
    return bitcode;
  }
}
