import * as assert from 'assert';
import {
  Builder as BitcodeBuilder,
  builder as bitcodeBuilderNS,
  Module as Bitcode,
} from 'bitcode';
import { Buffer } from 'buffer';

import * as code from '../code';
import * as constants from '../constants';
import * as node from '../node';
import { ISpanAllocatorResult } from '../span';
import { Identifier } from '../utils';

import irTypes = bitcodeBuilderNS.types;
import irValues = bitcodeBuilderNS.values;
import IRSignature = irTypes.Signature;
import IRDeclaration = irValues.constants.Declaration;
import IRFunc = irValues.constants.Func;
import IRBasicBlock = irValues.BasicBlock;
import IRPhi = irValues.instructions.Phi;
import IRType = irTypes.Type;
import IRValue = irValues.Value;

export {
  irTypes, irValues, IRBasicBlock, IRDeclaration, IRFunc, IRPhi, IRSignature,
  IRType, IRValue,
};

export interface ICompilationOptions {
  readonly debug?: string;
}

export interface ICompilationProperty {
  readonly name: string;
  readonly ty: string;
}

export interface ISignatureMap {
  readonly callback: {
    readonly match: IRSignature;
    readonly span: IRSignature;
    readonly value: IRSignature;
  };
  readonly node: IRSignature;
}

export type IProfWeight = 'likely' | 'unlikely' | number;

export interface IBranchResult {
  readonly onFalse: IRBasicBlock;
  readonly onTrue: IRBasicBlock;
}

export interface IBranchWeight {
  readonly onFalse: IProfWeight;
  readonly onTrue: IProfWeight;
}

export interface ISwitchResult {
  readonly cases: ReadonlyArray<IRBasicBlock>;
  readonly otherwise: IRBasicBlock;
}

export interface ISwitchWeight {
  readonly cases: ReadonlyArray<IProfWeight>;
  readonly otherwise: IProfWeight;
}

export class Compilation {
  public readonly ir: BitcodeBuilder;
  public readonly signature: ISignatureMap;
  public readonly state: irTypes.Struct;
  public readonly invariantGroup: irValues.constants.Metadata;

  private readonly bitcode: Bitcode = new Bitcode();
  private readonly cstringCache: Map<string, IRValue> = new Map();
  private readonly globalId: Identifier = new Identifier('g_');
  private readonly resumptionTargets: Set<IRDeclaration> = new Set();

  constructor(public readonly prefix: string,
              public readonly root: node.Node,
              private readonly properties: ReadonlyArray<ICompilationProperty>,
              spans: ISpanAllocatorResult,
              public readonly options: ICompilationOptions) {
    this.ir = this.bitcode.createBuilder();
    this.invariantGroup = this.ir.metadata([
      this.ir.metadata('llparse.invariant'),
    ]);

    this.state = this.ir.struct('state');

    this.signature = {
      callback: {
        match: this.ir.signature(constants.TYPE_OUTPUT, [
          this.state.ptr(),
          constants.TYPE_POS,
          constants.TYPE_ENDPOS,
        ]),
        span: this.ir.signature(constants.TYPE_OUTPUT, [
          this.state.ptr(),
          constants.TYPE_POS,
          constants.TYPE_ENDPOS,
        ]),
        value: this.ir.signature(constants.TYPE_OUTPUT, [
          this.state.ptr(),
          constants.TYPE_POS,
          constants.TYPE_ENDPOS,
          constants.TYPE_MATCH,
        ]),
      },
      node: this.ir.signature(constants.TYPE_OUTPUT, [
        this.state.ptr(),
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

  public buildBitcode(init: IRDeclaration): Buffer {
    return this.bitcode.build();
  }

  public buildHeader(): string {
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

  public stateArg(bb: IRBasicBlock): IRValue {
    return bb.parent.getArgument(constants.ARG_STATE);
  }

  public posArg(bb: IRBasicBlock): IRValue {
    return bb.parent.getArgument(constants.ARG_POS);
  }

  public endPosArg(bb: IRBasicBlock): IRValue {
    return bb.parent.getArgument(constants.ARG_ENDPOS);
  }

  public matchArg(bb: IRBasicBlock): IRValue {
    return bb.parent.getArgument(constants.ARG_MATCH);
  }

  // State fields

  public indexField(bb: IRBasicBlock): IRValue {
    return this.stateField(bb, constants.STATE_INDEX);
  }

  public currentField(bb: IRBasicBlock): IRValue {
    return this.stateField(bb, constants.STATE_CURRENT);
  }

  public errorField(bb: IRBasicBlock): IRValue {
    return this.stateField(bb, constants.STATE_ERROR);
  }

  public reasonField(bb: IRBasicBlock): IRValue {
    return this.stateField(bb, constants.STATE_REASON);
  }

  public errorPosField(bb: IRBasicBlock): IRValue {
    return this.stateField(bb, constants.STATE_ERROR_POS);
  }

  public spanPosField(bb: IRBasicBlock, index: number): IRValue {
    return this.stateField(bb, constants.STATE_SPAN_POS + index);
  }

  public spanCbField(bb: IRBasicBlock, index: number): IRValue {
    return this.stateField(bb, constants.STATE_SPAN_CB + index);
  }

  public stateField(bb: IRBasicBlock, name: string): IRValue {
    const state = this.stateArg(bb);
    const GEP_OFF = constants.GEP_OFF;
    const index = this.state.lookupField(name).index;
    return bb.getelementptr(state, GEP_OFF.val(0), GEP_OFF.val(index), true);
  }

  // Globals

  public cstring(value: string): IRValue {
    if (this.cstringCache.has(value)) {
      return this.cstringCache.get(value)!;
    }

    const res = this.addGlobalConst('cstr', this.ir.cstring(value));
    this.cstringCache.set(value, res);
    return res;
  }

  public blob(value: Buffer): IRValue {
    return this.addGlobalConst('blob', this.ir.blob(value));
  }

  public addGlobalConst(name: string, init: irValues.constants.Constant)
    : IRValue {
    const uniqueName = this.globalId.id(name).name;

    const glob = this.ir.global(init.ty.ptr(), uniqueName, init);
    glob.linkage = 'internal';
    glob.markConstant();
    this.bitcode.add(glob);
    return glob;
  }

  public declareFunction(signature: IRSignature, name: string): IRDeclaration {
    const decl = signature.declareFunction(name);
    this.bitcode.add(decl);
    return decl;
  }

  public defineFunction(signature: IRSignature, name: string,
                        paramNames: ReadonlyArray<string>): IRFunc {
    const fn = signature.defineFunction(name, paramNames);
    this.bitcode.add(fn);
    return fn;
  }

  // Miscellaneous

  public addResumptionTarget(decl: IRDeclaration): void {
    this.resumptionTargets.add(decl);
  }

  public branch(bb: IRBasicBlock, condition: IRValue,
                weights?: IBranchWeight): IBranchResult {
    const onTrue = bb.parent.createBlock('on_true');
    const onFalse = bb.parent.createBlock('on_false');

    const br = bb.branch(condition, onTrue, onFalse);

    if (weights !== undefined) {
      const WEIGHT = constants.BRANCH_WEIGHT;

      br.metadata.set('prof', this.ir.metadata([
        this.ir.metadata('branch_weights'),
        this.ir.metadata(WEIGHT.val(this.toProfWeight(weights.onTrue))),
        this.ir.metadata(WEIGHT.val(this.toProfWeight(weights.onFalse))),
      ]));
    }

    return { onTrue, onFalse };
  }

  public switch(bb: IRBasicBlock, value: IRValue, keys: ReadonlyArray<number>,
                weights?: ISwitchWeight): ISwitchResult {
    const otherwise = bb.parent.createBlock('otherwise');
    const cases = keys.map((key) => {
      return {
        block: bb.parent.createBlock(`case_${key}`),
        value: value.ty.toInt().val(key),
      };
    });

    const br = bb.switch(value, otherwise, cases);

    if (weights !== undefined) {
      const WEIGHT = constants.BRANCH_WEIGHT;
      assert.strictEqual(weights.cases.length, keys.length);

      const list = [
        this.ir.metadata('branch_weights'),
        this.ir.metadata(WEIGHT.val(this.toProfWeight(weights.otherwise))),
      ];

      for (const weight of weights.cases) {
        list.push(this.ir.metadata(WEIGHT.val(this.toProfWeight(weight))));
      }
      br.metadata.set('prof', this.ir.metadata(list));
    }

    return { otherwise, cases: cases.map((c) => c.block) };
  }

  public truncate(bb: IRBasicBlock, value: IRValue, toTy: IRType,
                  isSigned: boolean = false) {
    const fromTy = value.ty;
    assert(toTy.isInt());
    assert(fromTy.isInt());

    const fromITy = fromTy.toInt();
    const toITy = toTy.toInt();

    let res: IRValue;

    // Same type!
    if (fromITy.isEqual(toITy)) {
      res = value;
    // Extend
    } else if (fromITy.width < toITy.width) {
      if (isSigned) {
        res = bb.cast('sext', value, toITy);
      } else {
        res = bb.cast('zext', value, toITy);
      }
    // Truncate
    } else {
      assert(fromITy.width > toITy.width);
      res = bb.cast('trunc', value, toITy);
    }

    return res;
  }

  // Internals

  private toProfWeight(weight: IProfWeight): number {
    // Completely ad-hoc
    if (weight === 'likely') {
      return 0x10000;
    } else if (weight === 'unlikely') {
      return 1;
    } else {
      return weight;
    }
  }
}
