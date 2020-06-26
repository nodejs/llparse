import * as assert from 'assert';
import {
  Builder as BitcodeBuilder,
  builder as bitcodeBuilderNS,
  Module as Bitcode,
} from 'bitcode';
import { Buffer } from 'buffer';
import * as frontend from 'llparse-frontend';

import { IStructStateFields } from '../../compiler/struct-state-fields-builder'
import * as constants from './constants';
import { MatchSequence } from './helpers/match-sequence';
import { Code } from './code';
import { Node } from './node';
import { Transform } from './transform';

import irTypes = bitcodeBuilderNS.types;
import irValues = bitcodeBuilderNS.values;
import IRSignature = irTypes.Signature;
import IRDeclaration = irValues.constants.Declaration;
import IRFunc = irValues.constants.Func;
import IRBasicBlock = irValues.BasicBlock;
import IRPhi = irValues.instructions.Phi;
import IRType = irTypes.Type;
import IRValue = irValues.Value;

type TransformWrap = Transform<frontend.transform.Transform>;

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
  private readonly globalId = new frontend.Identifier('g_');
  private readonly matchSequence: Map<string, MatchSequence> = new Map();
  private debugMethod: IRDeclaration | undefined = undefined;

  constructor(public readonly prefix: string,
              fields: IStructStateFields,
              private readonly properties: ReadonlyArray<ICompilationProperty>,
              public readonly options: ICompilationOptions) {
    this.ir = this.bitcode.createBuilder();
    this.invariantGroup = this.ir.metadata([
      this.ir.metadata('llparse.invariant'),
    ]);

    this.state = this.ir.struct('state');

    this.signature = {
      callback: {
        match: this.ir.signature(constants.INT, [
          this.state.ptr(),
          constants.TYPE_POS,
          constants.TYPE_ENDPOS,
        ]),
        span: this.ir.signature(constants.INT, [
          this.state.ptr(),
          constants.TYPE_POS,
          constants.TYPE_ENDPOS,
        ]),
        value: this.ir.signature(constants.INT, [
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

    const propTypeMap: { [key: string]: IRType } = {
      uint8_t: constants.I8,
      uint16_t: constants.I16,
      uint32_t: constants.I32,
      uint64_t: constants.I64,
      'void*': constants.PTR,
    };

    const typeMap: { [key: string]: IRType } = {
      [constants.STATE_INDEX]: constants.TYPE_INDEX,
      [constants.STATE_ERROR]: constants.TYPE_ERROR,
      [constants.STATE_REASON]: constants.TYPE_REASON,
      [constants.STATE_ERROR_POS]: constants.TYPE_ERROR_POS,
      [constants.STATE_DATA]: constants.TYPE_DATA,
      [constants.STATE_CURRENT]: this.signature.node.ptr(),
    };

    for (const { name, type } of fields) {
      const isProp = properties.some((p) => p.name === name);
      if (isProp) {
        this.state.addField(propTypeMap[type], name);
        continue;
      }

      let ty = typeMap[name];
      if (!ty) {
        if (name.startsWith(constants.STATE_SPAN_POS)) {
          ty = constants.TYPE_SPAN_POS;
        } else if (name.startsWith(constants.STATE_SPAN_CB)) {
          ty = this.signature.callback.span.ptr();
        } else {
          throw new Error(`Unknow field: "${name}"`);
        }
      }

      this.state.addField(ty, name);
    }

    this.state.finalize();
  }

  public buildBitcode(init: IRDeclaration): Buffer {
    return this.bitcode.build();
  }

  // MatchSequence cache

  public getMatchSequence(
    transform: frontend.IWrap<frontend.transform.Transform>, select: Buffer)
    : IRDeclaration {
    const wrap = this.unwrapTransform(transform);

    let match: MatchSequence;
    if (this.matchSequence.has(wrap.ref.name)) {
      match = this.matchSequence.get(wrap.ref.name)!;
    } else {
      match = new MatchSequence(wrap);
      this.matchSequence.set(wrap.ref.name, match);
    }
    match.addSequence(select);
    return match.preBuild(this);
  }

  public buildMatchSequence(): void {
    for (const match of this.matchSequence.values()) {
      match.build(this);
    }
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

  public debug(bb: IRBasicBlock, message: string): IRBasicBlock {
    if (this.options.debug === undefined) {
      return bb;
    }

    // Lazily declare debug method
    if (this.debugMethod === undefined) {
      const sig = this.ir.signature(this.ir.void(), [
        this.state.ptr(),
        constants.TYPE_POS,
        constants.TYPE_ENDPOS,
        constants.TYPE_DEBUG_MSG,
      ]);

      this.debugMethod = this.declareFunction(sig, this.options.debug);
    }

    const str = this.cstring(message);
    const GEP_OFF = constants.GEP_OFF;
    const cast = bb.getelementptr(str, GEP_OFF.val(0), GEP_OFF.val(0), true);

    bb.call(this.debugMethod!, [
      this.stateArg(bb),
      this.posArg(bb),
      this.endPosArg(bb),
      cast,
    ]);

    return bb;
  }

  public unwrapCode(code: frontend.IWrap<frontend.code.Code>)
    : Code<frontend.code.Code> {
    const container = code as frontend.ContainerWrap<frontend.code.Code>;
    return container.get(constants.CONTAINER_KEY);
  }

  public unwrapNode(node: frontend.IWrap<frontend.node.Node>)
    : Node<frontend.node.Node> {
    const container = node as frontend.ContainerWrap<frontend.node.Node>;
    return container.get(constants.CONTAINER_KEY);
  }

  public unwrapTransform(node: frontend.IWrap<frontend.transform.Transform>)
    : Transform<frontend.transform.Transform> {
    const container =
        node as frontend.ContainerWrap<frontend.transform.Transform>;
    return container.get(constants.CONTAINER_KEY);
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
