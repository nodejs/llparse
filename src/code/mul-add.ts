import {
  Compilation, IRBasicBlock, IRDeclaration, IRType,
} from '../compilation';
import { BOOL } from '../constants';
import { toCacheKey } from '../utils';
import { Field } from './field';

export interface IMulAddOptions {
  readonly base: number;
  readonly max?: number;
  readonly signed: boolean;
}

interface IMulIntrinsics {
  readonly add: IRDeclaration;
  readonly mul: IRDeclaration;
}

function toOptionsKey(options: IMulAddOptions): string {
  let res = `base_${toCacheKey(options.base)}`;
  if (options.max !== undefined) {
    res += `_max_${toCacheKey(options.max)}`;
  }
  if (options.signed !== undefined) {
    res += `_signed_${toCacheKey(options.signed)}`;
  }
  return res;
}

export class MulAdd extends Field {
  constructor(name: string, field: string,
              private readonly options: IMulAddOptions) {
    super('value', `mul_add_${field}_${toOptionsKey(options)}`, name, field);
  }

  protected doBuild(ctx: Compilation, bb: IRBasicBlock): void {
    const options = this.options;
    const field = bb.load(ctx.stateField(bb, this.field));
    const fieldTy = field.ty.toInt();
    const returnTy = bb.parent.ty.toSignature().returnType;

    const intrinsics = this.buildIntrinsics(ctx, fieldTy);

    // Truncate/extend `match`
    const match = ctx.truncate(bb, ctx.matchArg(bb), fieldTy, !!options.signed);

    // Multiply
    const mul = bb.call(intrinsics.mul, [ field, fieldTy.val(options.base) ]);

    const product = bb.extractvalue(mul,
      mul.ty.toStruct().lookupField('result').index);
    const overflowBit = bb.extractvalue(mul,
      mul.ty.toStruct().lookupField('overflow').index);

    const { onTrue: isOverflow, onFalse: normal } =
      ctx.branch(bb, overflowBit, { onTrue: 'unlikely', onFalse: 'likely' });

    // Multiplication overflow
    isOverflow.name = 'overflow';
    isOverflow.ret(returnTy.val(1));

    // Normal multiplication
    normal.name = 'no_overflow';

    // Add
    const add = normal.call(intrinsics.add, [ product, match ]);

    const result = normal.extractvalue(add,
      add.ty.toStruct().lookupField('result').index);
    const addOverflowBit = normal.extractvalue(add,
      add.ty.toStruct().lookupField('overflow').index);

    const { onTrue: isAddOverflow, onFalse: check } = ctx.branch(normal,
      addOverflowBit, { onTrue: 'unlikely', onFalse: 'likely' });

    // Addition overflow
    isAddOverflow.name = 'add_overflow';
    isAddOverflow.ret(returnTy.val(1));

    // Check that we're within the limits
    check.name = 'check';
    let store: IRBasicBlock;
    if (options.max !== undefined) {
      const cond = options.signed ? 'sgt' : 'ugt';
      const cmp = check.icmp(cond, result, fieldTy.val(options.max));
      const { onTrue: maxOverflow, onFalse: noMaxOverflow } =
        ctx.branch(check, cmp, { onTrue: 'unlikely', onFalse: 'likely' });

      maxOverflow.name = 'max_overflow';
      maxOverflow.ret(returnTy.val(1));

      store = noMaxOverflow;
    } else {
      store = check;
    }
    store.name = 'store';

    store.store(result, ctx.stateField(bb, this.field));
    store.ret(returnTy.val(0));
  }

  private buildIntrinsics(ctx: Compilation, ty: IRType): IMulIntrinsics {
    const signed = this.options.signed;

    // Declare intrinsic functions
    const overRet = ctx.ir.struct();
    overRet.addField(ty.toInt(), 'result');
    overRet.addField(BOOL, 'overflow');
    overRet.finalize();

    const overSig = ctx.ir.signature(overRet, [ ty, ty ]);
    const postfix = `with.overflow.${ty.typeString}`;

    return {
      add: ctx.declareFunction(overSig,
        `llvm.${signed ? 'sadd' : 'uadd'}.${postfix}`),
      mul: ctx.declareFunction(overSig,
        `llvm.${signed ? 'smul' : 'umul'}.${postfix}`),
    };
  }
}
