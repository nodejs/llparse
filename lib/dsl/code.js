'use strict';

const assert = require('assert');

class Code {
  constructor(compiler, name) {
    this.compiler = compiler;

    this.name = name;
    this.deps = new Map();
  }

  error(ast, message) {
    this.compiler.error(ast, message);
  }

  compile(block) {
    const s = this.getSwitch(block);
    // TODO(indutny): validate discriminant

    const cases = s.cases.map((node) => {
      if (node.consequent.length === 0) {
        this.error(node,
          'All `case`s in switch must have consequent statements');
      }

      return {
        test: node.test,
        body: this.compileBody(node, node.consequent)
      };
    })
  }

  compileBody(context, node) {
    console.log(node);
  }

  getSwitch(block) {
    let res = false;

    block.body.forEach((stmt) => {
      if (stmt.type !== 'SwitchStatement')
        return;

      if (res)
        this.error(stmt, 'Duplicate switch statement');

      res = stmt;
    });

    if (!res)
      this.error(block, 'No switch statement found in a state function');

    return res;
  }

  fillDep(dep, code) {
    assert.strictEqual(this.deps.get(dep), null);
    this.deps.set(dep, code);
  }
}
module.exports = Code;
