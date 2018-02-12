'use strict';

const dsl = require('./');

const INTRINSICS = new Set([ 'match', 'next', 'redirect', 'error' ]);

class Block {
  constructor(test, scope) {
    this.test = test;
    this.instructions = [];

    this.scope = new dsl.Scope(scope);
  }

  push(instr) {
    this.instructions.push(instr);
    return instr;
  }

  serialize(reporter) {
    let out = '';
    for (let i = 0; i < this.instructions.length; i++) {
      const instr = this.instructions[i].serialize(reporter);

      if (!Array.isArray(instr)) {
        out += '  ' + instr  + '\n';
        continue;
      }

      for (let j = 0; j < instr.length; j++)
        out += '  ' + instr[j] + '\n';
    }
    return out;
  }

  isFinished() {
    return this.instructions.length !== 0 &&
      this.instructions[this.instructions.length - 1].terminal;
  }
}

class Builder {
  constructor(reporter, state, settings, globals) {
    this.reporter = reporter;
    this.state = state;
    this.settings = settings;
    this.globals = globals;

    this.id = 1;
    this.blocks = [];
    this.block = null;

    this.directives = {
      isDefault: false
    };
  }

  error(node, message) {
    this.reporter.error(node, message);
  }

  static build(reporter, name, node) {
    if (node.type === 'ArrowFunctionExpression')
      return new dsl.ir.Code(name, node);

    if (node.type === 'Literal')
      return new dsl.ir.Constant(node);

    reporter.error(node,
      'Unexpected global value. Only arrow functions and literal are allowed');
  }

  build(node) {
    if (node.type !== 'ArrowFunctionExpression')
      return this.error(node, 'Can\'t build this');

    this.blocks = [];

    if (node.body.type !== 'BlockStatement') {
      this.error(node.body, 'Global arrow functions must have block body');
      return;
    }

    // TODO(indutny): validate: no async, no iterator, arguments, etc
    let s = false;
    node.body.body.forEach((stmt) => {
      if (stmt.type === 'ExpressionStatement' && stmt.directive) {
        return this.processDirective(stmt);
      } else if (stmt.type === 'SwitchStatement') {
        if (s)
          return this.error(stmt, 'Duplicate switch statement');

        s = stmt;
      }
    });
    if (!s)
      return this.error(node, 'No switch statement in an arrow function');

    this.buildSwitch(s);

    return this.blocks;
  }

  processDirective(stmt) {
    if (stmt.directive === dsl.constants.directives.DEFAULT)
      this.directives.isDefault = true;

    // TODO(indutny): warn on unknown directives
  }

  buildSwitch(stmt) {
    // TODO(indutny): validate discriminant
    stmt.cases.forEach((c) => {
      let stmts;

      if (c.consequent.length === 1 &&
          c.consequent[0].type === 'BlockStatement') {
        stmts = c.consequent[0].body;
      } else {
        stmts = c.consequent;
      }

      if (stmts.length < 1)
        return this.error(c, 'Missing required `break` statement');

      const last = stmts[stmts.length - 1];
      if (last.type !== 'BreakStatement')
        return this.error(last, 'Missing required `break` statement');

      // TODO(indutny): parse `test`
      const block = new Block(c.test, this.globals);
      this.blocks.push(block);

      this.block = block;
      for (let i = 0; i < stmts.length - 1; i++)
        this.buildStatement(stmts[i]);
      this.block = null;
    });
  }

  buildStatement(stmt) {
    if (stmt.type === 'ExpressionStatement' &&
        stmt.expression.type === 'Literal') {
      return this.processBlockDirective(stmt);
    } else if (stmt.type === 'ExpressionStatement') {
      return this.buildExpression(stmt.expression);
    }

    return this.error(stmt, `Unknown statement type: ${stmt.type}`);
  }

  buildExpression(expr) {
    if (expr.type === 'CallExpression')
      return this.buildCall(expr);
    else if (expr.type === 'Identifier')
      return this.buildIdentifier(expr);
    else if (expr.type === 'Literal')
      return this.buildLiteral(expr);
    else if (expr.type === 'AssignmentExpression')
      return this.buildAssignment(expr);

    return this.error(expr, `Unknown expression type: ${expr.type}`);
  }

  buildCall(call) {
    const callee = call.callee;
    const args = call.arguments.map(arg => this.buildExpression(arg));

    if (callee.type === 'Identifier' && INTRINSICS.has(callee.name))
      return this.buildIntrinsic(call, callee.name, args);

    return this.error(call, `Unsupported callee: ${callee.type}`);
  }

  buildIntrinsic(node, name, args) {
    return this.push(node, new dsl.ir.Intrinsic(name, args));
  }

  buildIdentifier(id) {
    return this.block.scope.lookup(id, this);
  }

  buildLiteral(literal) {
    return new dsl.ir.Constant(literal);
  }

  buildAssignment(expr) {
    const left = expr.left;

    if (left.type !== 'MemberExpression' ||
        left.object.type !== 'Identifier' ||
        left.object.name !== 'state') {
      return this.error(left, 'Expected a property of `state` object');
    }

    if (left.computed)
      return this.error(left, 'Property of `state` object can\'t be computed');

    const prop = left.property.name;
    if (!this.state.has(prop)) {
      return this.error(left.property,
        `Unknown \`state\` property name ${prop}`);
    }

    const lookup = this.state.lookup(prop);
    const right = this.buildExpression(expr.right);
    this.push(expr, new dsl.ir.StateStore(lookup, right));
    return right;
  }

  processBlockDirective(stmt) {
    const directive = stmt.expression.value;

    // TODO(indutny): warn on unknown directives
  }

  push(ast, instr) {
    if (instr.out === null)
      instr.out = this.id++;

    if (typeof instr.tmp === 'number') {
      const tmp = [];
      for (let i = 0; i < instr.tmp; i++)
        tmp.push(this.id++);
      instr.tmp = tmp;
    }

    instr.ast = ast;

    return this.block.push(instr);
  }
}
module.exports = Builder;
