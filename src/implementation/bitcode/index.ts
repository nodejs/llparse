import { Buffer } from 'buffer';
import * as debugAPI from 'debug';
import * as frontend from 'llparse-frontend';

import { IStructStateFields } from '../../compiler/struct-state-fields-builder'
import { Compilation } from './compilation';
import { CONTAINER_KEY } from './constants';
import code from './code';
import node from './node';
import { Node } from './node';
import transform from './transform';
import { ExecuteBuilder } from './helpers/execute-builder';
import { InitBuilder } from './helpers/init-builder';

const debug = debugAPI('llparse:bitcode');

export interface IBitcodeCompilerOptions {
  readonly debug?: string;
}

export class BitcodeCompiler {
  constructor(container: frontend.Container,
              private readonly options: IBitcodeCompilerOptions) {
    container.add(CONTAINER_KEY, { code, node, transform });
  }

  public compile(fields: IStructStateFields, info: frontend.IFrontendResult): Buffer {
    // Compile to bitcode
    const compilation = new Compilation(info.prefix, fields, info.properties,
        this.options);

    debug('building root');
    const root = info.root as frontend.ContainerWrap<frontend.node.Node>;
    const initFn = root.get<Node<frontend.node.Node>>(CONTAINER_KEY)
        .build(compilation);

    debug('building match sequence');
    compilation.buildMatchSequence();

    debug('building init');
    const ib = new InitBuilder();
    ib.build(compilation, initFn);

    debug('building execute');
    const eb = new ExecuteBuilder();
    eb.build(compilation, info);

    debug('building bitcode');
    const bitcode = compilation.buildBitcode(initFn);

    debug('done');
    return bitcode;
  }
}
