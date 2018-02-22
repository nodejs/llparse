'use strict';

const kName = Symbol('name');

class Transform {
  constructor(name) {
    this[kName] = name;
  }

  get name() { return this[kName]; }
}
module.exports = Transform;
