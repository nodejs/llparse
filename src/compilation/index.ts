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

export interface ISignatureMap {
  readonly callback: {
    readonly match: irTypes.Signature;
    readonly span: irTypes.Signature;
    readonly value: irTypes.Signature;
  };
  readonly node: irTypes.Signature;
}

export class Compilation {
  public readonly ir: BitcodeBuilder;
  public readonly signature: ISignatureMap;
  private readonly bitcode: Bitcode = new Bitcode();
  private readonly state: irTypes.Struct;

  constructor(public readonly root: node.Node,
              private readonly properties: ReadonlyArray<ICompilationProperty>,
              public readonly options: ICompilationOptions) {
    this.ir = this.bitcode.createBuilder();

    this.state = this.ir.struct('state');

    this.signature = {
      callback: {
        match: this.ir.signature(constants.TYPE_OUTPUT, [
          this.state,
          constants.TYPE_POS,
          constants.TYPE_ENDPOS,
        ]),
        span: this.ir.signature(constants.TYPE_OUTPUT, [
          this.state,
          constants.TYPE_POS,
          constants.TYPE_ENDPOS,
        ]),
        value: this.ir.signature(constants.TYPE_OUTPUT, [
          this.state,
          constants.TYPE_POS,
          constants.TYPE_ENDPOS,
          constants.TYPE_MATCH,
        ]),
      },
      node: this.ir.signature(constants.TYPE_OUTPUT, [
        this.state,
        constants.TYPE_POS,
        constants.TYPE_ENDPOS,
        constants.TYPE_MATCH,
      ]),
    };

    this.state.addField(this.signature.node.ptr(), constants.STATE_CURRENT);
    this.state.addField(constants.TYPE_ERROR, constants.STATE_ERROR);
    this.state.addField(constants.TYPE_REASON, constants.STATE_REASON);
    this.state.addField(constants.TYPE_ERROR_POS, constants.STATE_ERROR_POS);
    this.state.addField(constants.TYPE_DATA, constants.STATE_DATA);

    for (const property of properties) {
      let ty: IRType;
      switch (property.ty) {
        case 'i8': ty = constants.I8; break;
        case 'i16': ty = constants.I16; break;
        case 'i32': ty = constants.I32; break;
        case 'i64': ty = constants.I64; break;
        case 'ptr': ty = constants.PTR; break;
        default: throw new Error(`Unsupported user type: "${property.ty}"`);
      }

      this.state.addField(ty, property.name);
    }

    this.state.finalize();
  }

  public buildBitcode(): Buffer {
    return this.bitcode.build();
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
