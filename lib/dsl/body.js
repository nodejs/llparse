'use strict';

const dsl = require('./');

const INTRINSICS = {
  next: dsl.ir.instruction.Next,
  redirect: dsl.ir.instruction.Redirect,
  error: dsl.ir.instruction.Error
};

class Body {
  constructor(reporter, index, parent) {
    this.reporter = reporter;
    this.index = index;
    this.parent = parent || null;

    this.used = new Set();
    this.local = new Map();
    this.ir = [];
  }

  error(node, string) {
    return this.reporter.error(node, string);
  }

  compile(stmts) {
    stmts.forEach(stmt => this.compileStatement(stmt));
  }

  compileStatement(stmt) {
    if (stmt.type === 'ExpressionStatement')
      return this.compileExpression(stmt.expression);

    this.error(stmt, `Unsupported statement type: ${stmt.type}`);
  }

  compileExpression(expr) {
    if (expr.type === 'CallExpression')
      return this.compileCall(expr);
    else if (expr.type === 'Literal')
      return { type: 'Literal', value: expr.value };

    this.error(expr, `Unsupported expression type: ${expr.type}`);
  }

  compileCall(call) {
    if (call.callee.type !== 'Identifier')
      this.error(call.callee, 'Invalid intrinsic name, must be Identifier');

    const name = call.callee.name;
    if (!INTRINSICS.hasOwnProperty(name))
      this.error(call.callee, 'Unknown intrinsic');

    const Instruction = INTRINSICS[name];

    if (!Instruction.validateArgs(call.arguments))
      this.error(call, 'Invalid arguments for intrinsic');

    this.push(new Instruction(call.arguments, this));

    return null;
  }

  getDeps() {
    return this.ir
      .filter(instr => instr.type === 'redirect' || instr.type === 'next')
      .map(instr => instr.target);
  }

  // Mostly helpers

  push(instr) {
    this.ir.push(instr);
  }

  lookup(id, source) {
    if (this.local.has(id.name))
      return this.local.get(id.name);

    source = source || this;
    if (this.parent)
      return this.parent.lookup(id, source);

    source.error(id, 'Unknown local variable');
  }

  define(id, value) {
    if (this.local.has(id.name))
      return this.error(id, 'Re-definition of const variable');

    let sanitized = `b_${this.index}_v` +
      name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    if (this.used.has(sanitized)) {
      for (let i = 1; ; i++)
        if (!this.used.has(sanitized + `_${i}`))
          break;

      sanitized += `_${i}`;
    }

    this.local.set(id.name, { name: sanitized, value });
  }

  label(name) {
    return `b${this.index}_l_${name}`;
  }
}
module.exports = Body;
