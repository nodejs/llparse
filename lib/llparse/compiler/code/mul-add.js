'use strict';

const code = require('./');
const llparse = require('../../');

const BOOL = llparse.constants.BOOL;
const INT = llparse.constants.INT;

class MulAdd extends code.Code {
  constructor(name, field, options) {
    super('mulAdd', 'value', name);

    this.field = field;
    this.options = options;
    this.cacheKey = `mul_add_${this.field}_${JSON.stringify(this.options)}`;
  }

  build(ctx, fn) {
    const ir = ctx.ir;
    const body = fn.body;
    const match = ctx.matchArg(fn);
    const matchType = match.type;
    const ret = fn.type.ret;
    const field = this.field;
    const options = this.options;

    // TODO(indutny): de-duplicate this
    const stateType = ctx.state;
    const fieldType = stateType.fields[stateType.lookup(field)].type;

    // Declare intrinsic functions
    const overRet = ir.struct([
      [ fieldType, 'result' ],
      [ BOOL, 'overflow' ]
    ]);

    const overSig = ir.signature(overRet, [ fieldType, fieldType ]);
    const mulFn = ir.declare(
      overSig,
      `llvm.${options.signed ? 'smul': 'umul'}.with.overflow.${fieldType.type}`
    );
    const addFn = ir.declare(
      overSig,
      `llvm.${options.signed ? 'sadd': 'uadd'}.with.overflow.${fieldType.type}`
    );

    // Truncate match and load field
    const value = ctx.truncate(body, matchType, match, fieldType,
      options.signed);
    const fieldValue = ctx.load(fn, body, field);

    // Multiply
    const mul = ctx.call('', overSig, mulFn, '',
      [ fieldValue, matchType.v(options.base) ]);
    body.push(mul);

    body.comment('extract product');
    const product = ir._('extractvalue', [ overRet, mul ],
      INT.v(overRet.lookup('result')));
    body.push(product);

    body.comment('extract overflow');
    const overflowBit = ir._('extractvalue', [ overRet, mul ],
      INT.v(overRet.lookup('overflow')));
    body.push(overflowBit);

    const { left: isOverflow, right: normal } =
      ctx.branch(body, overflowBit, [ 'unlikely', 'likely' ]);
    isOverflow.name = 'overflow';
    isOverflow.terminate('ret', [ ret, ret.v(1) ]);

    normal.name = 'no_overflow';

    // Add
    const add = ctx.call('', overSig, addFn, '', [ product, value ]);
    normal.push(add);

    normal.comment('extract result');
    const result = ir._('extractvalue', [ overRet, add ],
      INT.v(overRet.lookup('result')));
    normal.push(result);

    normal.comment('extract overflow');
    const addOverflowBit = ir._('extractvalue', [ overRet, add ],
      INT.v(overRet.lookup('overflow')));
    normal.push(addOverflowBit);

    const { left: isAddOverflow, right: check } =
      ctx.branch(normal, addOverflowBit, [ 'unlikely', 'likely' ]);
    isAddOverflow.name = 'add_overflow';
    check.name = 'check';

    isAddOverflow.terminate('ret', [ ret, ret.v(1) ]);

    // Check that we're within the limits
    let store;
    if (options.max) {
      const cond = options.signed ? 'sgt' : 'ugt';
      const cmp = ir._('icmp', [ cond, fieldType, result ],
        fieldType.v(options.max));
      check.push(cmp);

      const branch = ctx.branch(check, cmp, [ 'unlikely', 'likely' ]);
      branch.left.name = 'max_overflow';

      branch.left.terminate('ret', [ ret, ret.v(1) ]);

      store = branch.right;
    } else {
      store = check;
    }
    store.name = 'store';

    ctx.store(fn, store, field, result);
    store.terminate('ret', [ ret, ret.v(0) ]);
  }
}
module.exports = MulAdd;
