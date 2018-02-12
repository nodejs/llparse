'use strict';

const assert = require('assert');

const dsl = require('./');
const Block = dsl.Block;

class Code {
  constructor(reporter, name) {
    this.reporter = reporter;

    this.name = name;
    this.deps = new Map();
  }

  error(ast, message) {
    this.reporter.error(ast, message);
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

  compileBody(context, body) {
    if (body[body.length - 1].type !== 'BreakStatement') {
      this.error(body[body.length - 1],
        'Last statement in `case` body must be `break`');
    }

    const stmts = body.slice(0, -1);
    const block = new Block(this.reporter);
    block.compile(stmts);
    return block;
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
