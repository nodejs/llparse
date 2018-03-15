import {
  Builder as BitcodeBuilder,
  builder as bitcodeBuilderNS,
  Module as Bitcode,
} from 'bitcode';
import { Buffer } from 'buffer';

import * as constants from '../constants';
import * as node from '../node';
import { ISpanAllocatorResult } from '../span';

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

  constructor(public readonly prefix: string,
              public readonly root: node.Node,
              private readonly properties: ReadonlyArray<ICompilationProperty>,
              spans: ISpanAllocatorResult,
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

    this.state.addField(constants.TYPE_INDEX, constants.STATE_INDEX);
    this.state.addField(this.signature.node.ptr(), constants.STATE_CURRENT);
    this.state.addField(constants.TYPE_ERROR, constants.STATE_ERROR);
    this.state.addField(constants.TYPE_REASON, constants.STATE_REASON);
    this.state.addField(constants.TYPE_ERROR_POS, constants.STATE_ERROR_POS);
    this.state.addField(constants.TYPE_DATA, constants.STATE_DATA);

    spans.concurrency.forEach((concurrent, index) => {
      this.state.addField(constants.TYPE_SPAN_POS,
        constants.STATE_SPAN_POS + index);
      if (concurrent.length > 1) {
        this.state.addField(this.signature.callback.span.ptr(),
          constants.STATE_SPAN_CB + index);
      }
    });

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
    let res = '';
    const PREFIX = this.prefix.toUpperCase().replace(/[^a-z]/gi, '_');
    const DEFINE = `INCLUDE_${PREFIX}_H_`;

    res += `#ifndef ${DEFINE}\n`;
    res += `#define ${DEFINE}\n`;
    res += '\n';

    res += '#include <stdint.h>\n';
    res += '\n';

    // Structure
    res += `typedef struct ${this.prefix}_s ${this.prefix}_t;\n`;
    res += `struct ${this.prefix}_s {\n`;
    for (const field of this.state.fields) {
      let ty: string;
      if (field.name === constants.STATE_REASON ||
          field.name === constants.STATE_ERROR_POS) {
        ty = 'const char*';
      } else if (field.ty.isEqual(constants.I8)) {
        ty = 'int8_t';
      } else if (field.ty.isEqual(constants.I16)) {
        ty = 'int16_t';
      } else if (field.ty.isEqual(constants.I32)) {
        ty = 'int32_t';
      } else if (field.ty.isEqual(constants.I64)) {
        ty = 'int32_t';
      } else if (field.name === constants.STATE_CURRENT ||
                 field.ty.isEqual(constants.PTR)) {
        ty = 'void*';
      } else {
        throw new Error(
          `Unknown state property type: "${field.ty.typeString}"`);
      }
      res += `  ${ty} ${field.name};\n`;
    }
    res += '};\n';

    res += '\n';

    res += `int ${this.prefix}_init(${this.prefix}_t* s);\n`;
    res += `int ${this.prefix}_execute(${this.prefix}_t* s, ` +
      'const char* p, const char* endp);\n';

    res += '\n';
    res += `#endif  /* ${DEFINE} */\n`;

    return res;
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

  // State fields

  public indexField(fn: IRFunc, body: IRBasicBlock): IRValue {
    return this.stateField(fn, body, constants.STATE_INDEX);
  }

  public currentField(fn: IRFunc, body: IRBasicBlock): IRValue {
    return this.stateField(fn, body, constants.STATE_CURRENT);
  }

  public errorField(fn: IRFunc, body: IRBasicBlock): IRValue {
    return this.stateField(fn, body, constants.STATE_ERROR);
  }

  public reasonField(fn: IRFunc, body: IRBasicBlock): IRValue {
    return this.stateField(fn, body, constants.STATE_REASON);
  }

  public errorPosField(fn: IRFunc, body: IRBasicBlock): IRValue {
    return this.stateField(fn, body, constants.STATE_ERROR_POS);
  }

  public spanPosField(fn: IRFunc, body: IRBasicBlock, index: number): IRValue {
    return this.stateField(fn, body, constants.STATE_SPAN_POS + index);
  }

  public spanCbField(fn: IRFunc, body: IRBasicBlock, index: number): IRValue {
    return this.stateField(fn, body, constants.STATE_SPAN_CB + index);
  }

  // Internals

  private stateField(fn: IRFunc, body: IRBasicBlock, name: string): IRValue {
    const state = this.stateArg(fn);
    const GEP_OFF = constants.GEP_OFF;
    const index = this.state.lookupField(name).index;
    return body.getelementptr(state, GEP_OFF.val(0), GEP_OFF.val(index), true);
  }
}
