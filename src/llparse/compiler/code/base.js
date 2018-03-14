'use strict';

const assert = require('assert');

class Code {
  constructor(type, signature, name) {
    this.type = type;
    this.signature = signature;
    this.name = name;

    this.isExternal = false;
    this.cacheKey = this;
  }

  // Just for cache key generation
  numKey(num) {
    if (num < 0)
      return 'm' + (-num);
    else
      return num.toString();
  }

  getTypes(ctx, fn, field) {
    const fieldType = ctx.state.lookupField(field).ty;
    const returnType = fn.ty.toSignature().returnType;
    assert(fieldType.isInt(), `"${field}" field is not of integer type`);
    assert(returnType.isInt());

    return { fieldType, returnType };
  }

  build() {
    throw new Error('Not implemented');
  }
}
module.exports = Code;
