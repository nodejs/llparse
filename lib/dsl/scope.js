'use strict';

class Scope {
  constructor(parent) {
    this.parent = parent || null;

    this.local = new Map();
  }

  forEach(cb) {
    this.local.forEach(cb);
  }

  lookup(id, source) {
    if (this.local.has(id.name))
      return this.local.get(id.name);

    if (this.parent)
      return this.parent.lookup(id, source);

    source.error(id, `Unknown variable name ${id.name}`);
  }

  define(id, value, source) {
    if (this.local.has(id.name))
      return source.error(id, 'Re-definition of const variable');

    this.local.set(id.name, value);
  }

}
module.exports = Scope;
