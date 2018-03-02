'use strict';

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

  build() {
    throw new Error('Not implemented');
  }
}
module.exports = Code;
