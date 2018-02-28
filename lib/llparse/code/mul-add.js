'use strict';

const assert = require('assert');

const llparse = require('../');
const code = require('./');

const BOOL = llparse.constants.BOOL;
const INT = llparse.constants.INT;

const kOptions = Symbol('options');
const kCompile = Symbol('compile');

class MulAdd extends code.Value {
  constructor(name, field, options) {
    const body = context => this[kCompile](context, field);

    super(name, body);

    options = Object.assign({
      max: 0,
      signed: true
    }, options);
    assert.strictEqual(typeof options.max, 'number',
      '`MulAdd.options.max` must be a number');
    assert.strictEqual(typeof options.base, 'number',
      '`MulAdd.options.base` must be a number');
    assert(options.max >= 0,
      '`MulAdd.options.max` must be a non-negative number');
    assert(options.base > 0,
      '`MulAdd.options.base` must be a positive number');
    assert.strictEqual(options.max, options.max | 0,
      '`MulAdd.options.max` must be an integer');
    assert.strictEqual(options.base, options.base | 0,
      '`MulAdd.options.max` must be an integer');

    this[kOptions] = options;
  }

  [kCompile](context, field) {
    const ir = context.ir;
    const body = context.fn.body;
    const matchType = context.match.type;
    const options = this[kOptions];

    const stateType = context.state.type.to;
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
    const value = context.truncate(body, matchType, context.match, fieldType,
      options.signed);
    const fieldValue = context.load(body, field);

    // Multiply
    const mul = context.call('', overSig, mulFn, '',
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
      context.branch(body, overflowBit, [ 'unlikely', 'likely' ]);
    isOverflow.name = 'overflow';
    isOverflow.terminate('ret', [ context.ret, context.ret.v(1) ]);

    normal.name = 'no_overflow';

    // Add
    const add = context.call('', overSig, addFn, '', [ product, value ]);
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
      context.branch(normal, addOverflowBit, [ 'unlikely', 'likely' ]);
    isAddOverflow.name = 'add_overflow';
    check.name = 'check';

    isAddOverflow.terminate('ret', [ context.ret, context.ret.v(1) ]);

    // Check that we're within the limits
    let store;
    if (options.max) {
      const cond = options.signed ? 'sgt' : 'ugt';
      const cmp = ir._('icmp', [ cond, fieldType, result ],
        fieldType.v(options.max));
      check.push(cmp);

      const branch = context.branch(check, cmp, [ 'unlikely', 'likely' ]);
      branch.left.name = 'max_overflow';

      branch.left.terminate('ret', [ context.ret, context.ret.v(1) ]);

      store = branch.right;
    } else {
      store = check;
    }
    store.name = 'store';

    context.store(store, field, result);
    store.terminate('ret', [ context.ret, context.ret.v(0) ]);
  }
}
module.exports = MulAdd;
