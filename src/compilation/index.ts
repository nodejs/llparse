import {
  Builder as BitcodeBuilder,
  builder as bitcodeBuilderNS,
  Module as Bitcode,
} from 'bitcode';
import { Buffer } from 'buffer';

import * as constants from '../constants';
import * as node from '../node';

import irTypes = bitcodeBuilderNS.types;
import irValues = bitcodeBuilderNS.values;
import IRDeclaration = irValues.constants.Declaration;
import IRFunc = irValues.constants.Func;
import IRBasicBlock = irValues.BasicBlock;
import IRType = irTypes.Type;
import IRValue = irValues.Value;

export {
  irTypes, irValues, IRBasicBlock, IRDeclaration, IRFunc, IRType, IRValue,
};

export interface ICompilationOptions {
  debug?: string;
}

export interface ICompilationProperty {
  name: string;
  ty: string;
}

export class Compilation {
  public readonly ir: BitcodeBuilder;
  private readonly bitcode: Bitcode = new Bitcode();

  constructor(public readonly root: node.Node,
              properties: ReadonlyArray<ICompilationProperty>,
              public readonly options: ICompilationOptions) {
    this.ir = this.bitcode.createBuilder();
  }

  public buildBitcode(): Buffer {
    return Buffer.alloc(1);
  }

  public buildHeaders(): string {
    return '';
  }

  // Arguments

  public stateArg(fn: IRFunc): IRValue {
    return fn.getArgument(constants.ARG_STATE);
  }

  public posArg(fn: IRFunc): IRValue {
    return fn.getArgument(constants.ARG_POS);
  }

  public endPosArg(fn: IRFunc): IRValue {
    return fn.getArgument(constants.ARG_ENDPOS);
  }

  public matchArg(fn: IRFunc): IRValue {
    return fn.getArgument(constants.ARG_MATCH);
  }
}
