import * as frontend from 'llparse-frontend';

import { CONTAINER_KEY } from './constants';
import code from './code';
import node from './node';
import transform from './transform';

export interface ICCompilerOptions {
  readonly debug?: string;
}

export class CCompiler {
  constructor(container: frontend.Container,
              public readonly options: ICCompilerOptions) {
    // container.add(CONTAINER_KEY, { code, node, transform });
  }

  public compile(info: frontend.IFrontendResult): string {
    return '';
  }
}
