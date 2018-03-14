import { IMulAddOptions } from '../../code';
import { BOOL } from '../../constants';
import { Compilation } from '../compilation';
import { Code, Func } from './base';

export class MulAdd extends Code {
  constructor(name: string, private readonly field: string,
              private readonly options: IMulAddOptions) {
    super('mulAdd', 'value', name);

    this.privCacheKey = `mul_add_${this.field}_${JSON.stringify(this.options)}`;
  }

  public build(ctx: Compilation, fn: Func): void {
    const ir = ctx.ir;
    const body = fn.body;
    const match = ctx.matchArg(fn);
    const field = this.field;
    const options = this.options;

    const { fieldType, returnType } = this.getTypes(ctx, fn, field);

    // Declare intrinsic functions
    const overRet = ir.struct();
    overRet.addField(fieldType, 'result');
    overRet.addField(BOOL, 'overflow');
    overRet.finalize();

    const overSig = ir.signature(overRet, [ fieldType, fieldType ]);
    const postfix = `with.overflow.${fieldType.typeString}`;
    const mulFn = ctx.declareFunction(
      overSig,
      `llvm.${options.signed ? 'smul': 'umul'}.${postfix}`
    );
    const addFn = ctx.declareFunction(
      overSig,
      `llvm.${options.signed ? 'sadd': 'uadd'}.${postfix}`
    );

    // Truncate match and load field
    const value = ctx.truncate(body, match, fieldType,
      options.signed);
    const fieldValue = ctx.load(fn, body, field);

    // Multiply
    const mul = body.call(mulFn, [ fieldValue, fieldType.val(options.base) ]);

    const product = body.extractvalue(mul, overRet.lookupField('result').index);
    const overflowBit = body.extractvalue(mul,
      overRet.lookupField('overflow').index);

    const { left: isOverflow, right: normal } =
      ctx.branch(body, overflowBit, [ 'unlikely', 'likely' ]);
    isOverflow.name = 'overflow';
    isOverflow.ret(returnType.val(1));

    normal.name = 'no_overflow';

    // Add
    const add = normal.call(addFn, [ product, value ]);

    const result = normal.extractvalue(add,
      overRet.lookupField('result').index);
    const addOverflowBit = normal.extractvalue(add,
      overRet.lookupField('overflow').index);

    const { left: isAddOverflow, right: check } =
      ctx.branch(normal, addOverflowBit, [ 'unlikely', 'likely' ]);
    isAddOverflow.name = 'add_overflow';
    check.name = 'check';

    isAddOverflow.ret(returnType.val(1));

    // Check that we're within the limits
    let store;
    if (options.max) {
      const cond = options.signed ? 'sgt' : 'ugt';
      const cmp = check.icmp(cond, result, fieldType.val(options.max));
      const branch = ctx.branch(check, cmp, [ 'unlikely', 'likely' ]);
      branch.left.name = 'max_overflow';

      branch.left.ret(returnType.val(1));

      store = branch.right;
    } else {
      store = check;
    }
    store.name = 'store';

    ctx.store(fn, store, field, result);
    store.ret(returnType.val(0));
  }
}
