'use strict';

const assert = require('assert');
const esprima = require('esprima');

const kError = Symbol('error');
const kParseGlobals = Symbol('parseGlobals');
const kParseConfigObject = Symbol('parseConfigObject');
const kCompileState = Symbol('compileState');
const kCompileSettings = Symbol('compileSettings');

const types = require('./dsl/types');

const STATE_TYPES = types.STATE_TYPES;
const SETTINGS_TYPES = types.SETTINGS_TYPES;

class DSL {
  constructor(source) {
    this.source = source;

    this.ast = null;
    this.globals = null;
    this.state = null;
  }

  compile() {
    assert.strictEqual(this.ast, null,
      'Can\'t run twice without reinstantiating');

    this.ast = esprima.parse(this.source, { loc: true });
    assert.equal(this.ast.type, 'Program');

    this.globals = this[kParseGlobals](this.ast.body);

    let out = '';

    out += ';;; State Start\n\n';
    out += this[kCompileState]();
    out += '\n;;; State End\n\n';

    out += ';;; Settings Start\n\n';
    out += this[kCompileSettings]();
    out += '\n;;; Settings End \n\n';

    return out;
  }

  [kError](node, string) {
    if (!node || !node.loc || !node.loc.start)
      throw new Error(string + ' at unknown position');

    const start = node.loc.start;
    const err = new Error(string + ` at ${start.line}:${start.column}`);
    err.node = node;
    throw err;
  }

  [kParseGlobals](body) {
    const globals = new Map();

    const declaration = (decl) => {
      if (globals.has(decl.id.name))
        this[kError](decl.id, `Duplicate definition of ${decl.id.name}`);

      if (!decl.init)
        this[kError](decl, `Missing init value for ${decl.id.name}`);

      globals.set(decl.id.name, decl.init);
    };

    body.forEach((node) => {
      if (node.type !== 'VariableDeclaration')
        return;

      node.declarations.forEach(declaration);
    });

    return globals;
  }

  [kParseConfigObject](node, types) {
    if (node.type !== 'ObjectExpression') {
      this[kError](node,
        'Invalid configuration value type, must be ObjectExpression');
    }

    const result = [];
    node.properties.forEach((prop) => {
      if (prop.computed)
        this[kError](prop, 'Configuration properties can\'t be computed');

      if (prop.key.type !== 'Identifier') {
        this[kError](prop.key,
          'Configuration property keys must be Identifiers');
      }

      if (prop.value.type !== 'CallExpression') {
        this[kError](prop.key,
          'Configuration property values must be CallExpressions');
      }

      const key = prop.key.name;

      if (prop.value.callee.type !== 'Identifier')
        this[kError](value.callee, 'Unknown configuration property type');

      const type = prop.value.callee.name;
      const args = prop.value.arguments.map((arg) => {
        if (arg.type !== 'Literal')
          this[kError](args, 'Invalid argument type, must be Literal');

        return arg.value;
      });

      if (!types.hasOwnProperty(type))
        this[kError](value.callee, 'Unknown `state` property type');

      const validation = types[type](args);
      if (validation !== true) {
        this[kError](value.callee,
          `Invalid arguments for "${type}": ${validation}`);
      }

      result.push({ key, type, args });
    });
    return result;
  }

  [kCompileState]() {
    assert(this.globals.has('state'), 'Missing `state` global object');

    const props = this[kParseConfigObject](
      this.globals.get('state'), STATE_TYPES);

    const state = new Map();
    this.state = state;

    let out = '%state = type {\n';

    props.forEach((prop, index) => {
      const isLast = index === props.length - 1;

      out += `  ${prop.type}${isLast ? '' : ','}`;
      out += ` ; ${index} => ${prop.key}`;
      if (prop.args.length !== 0)
        out += ` ${JSON.stringify(prop.args)}`;
      out += '\n';

      state.set(prop.key, { index, type: prop.type, args: prop.args });
    });

    out += '}\n';

    return out;
  }

  [kCompileSettings]() {
    assert(this.globals.has('settings'), 'Missing `settings` global object');

    const props = this[kParseConfigObject](
      this.globals.get('settings'), SETTINGS_TYPES);

    const settings = new Map();
    this.settings = settings;

    let out = '%settings = type {\n';

    props.forEach((prop, index) => {
      const isLast = index === props.length - 1;

      let type;
      if (prop.type === 'notify')
        type = 'i32 (%state*)*';
      else
        type = 'i32 (%state*, i8*, i64)*';

      out += `  ${type}${isLast ? '' : ','}`;
      out += ` ; ${index} => ${prop.key}`;
      if (prop.args.length !== 0)
        out += ` ${JSON.stringify(prop.args)}`;
      out += '\n';

      settings.set(prop.key, { index, type: prop.type, args: prop.args });
    });

    out += '}\n';

    return out;
  }
}
module.exports = DSL;
