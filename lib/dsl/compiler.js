'use strict';

const assert = require('assert');
const esprima = require('esprima');

const dsl = require('./');

const Scope = dsl.Scope;
const State = dsl.State;
const Settings = dsl.Settings;
const Reporter = dsl.Reporter;
const Builder = dsl.Builder;

const STATE_TYPES = dsl.types.STATE_TYPES;
const SETTINGS_TYPES = dsl.types.SETTINGS_TYPES;

class Compiler {
  constructor(prefix, source) {
    this.prefix = prefix;
    this.source = source;

    this.ast = null;
    this.globals = null;
    this.state = null;
    this.settings = null;
    this.builder = null;
    this.reporter = new Reporter();

    this.code = new Map();

    this.defaultState = null;
  }

  compile() {
    this.ast = esprima.parse(this.source, { loc: true });
    assert.equal(this.ast.type, 'Program');

    this.globals = new Scope();
    this.state = new State();
    this.settings = new Settings();
    this.builder = new Builder(this.reporter, this.state, this.settings,
      this.globals);

    this.parseTopLevel(this.ast.body);

    this.buildCode();

    return this.serialize();
  }

  error(node, string) {
    return this.reporter.error(node, string);
  }

  parseTopLevel(body) {
    const globals = new Map();

    const declaration = (decl) => {
      if (!decl.init)
        return this.error(decl, `Missing init value for ${decl.id.name}`);

      // Re-use of previously defined value
      let init = decl.init;
      while (init.type === 'Identifier')
        init = this.globals.lookup(init);

      if (decl.id.name === 'state')
        return this.parseState(init);
      else if (decl.id.name === 'settings')
        return this.parseSettings(init);

      this.globals.define(decl.id,
        Builder.build(this.reporter, decl.id.name, init),
        this);
    };

    body.forEach((node) => {
      if (node.type === 'VariableDeclaration')
        return node.declarations.forEach(declaration);

      if (node.type === 'ExpressionStatement' && node.directive)
        return;

      this.error(node, 'Unsupported top-level node');
    });
  }

  parseConfigObject(node, types) {
    if (node.type !== 'ObjectExpression') {
      this.error(node,
        'Invalid configuration value type, must be ObjectExpression');
      return;
    }

    const result = [];
    node.properties.forEach((prop) => {
      if (prop.computed)
        return this.error(prop, 'Configuration properties can\'t be computed');

      if (prop.key.type !== 'Identifier') {
        this.error(prop.key,
          'Configuration property keys must be Identifiers');
        return;
      }

      if (prop.value.type !== 'CallExpression') {
        this.error(prop.key,
          'Configuration property values must be CallExpressions');
        return;
      }

      const key = prop.key.name;

      if (prop.value.callee.type !== 'Identifier')
        return this.error(value.callee, 'Unknown configuration property type');

      const type = prop.value.callee.name;
      const args = prop.value.arguments.map((arg) => {
        if (arg.type !== 'Literal')
          return this.error(args, 'Invalid argument type, must be Literal');

        return arg.value;
      });

      if (!types.hasOwnProperty(type))
        return this.error(value.callee, 'Unknown `state` property type');

      const validation = types[type](args);
      if (validation !== true) {
        this.error(value.callee,
          `Invalid arguments for "${type}": ${validation}`);
        return;
      }

      result.push({ key, type, args });
    });
    return result;
  }

  parseState(node) {
    const props = this.parseConfigObject(node, STATE_TYPES);

    props.forEach((prop) => {
      if (this.state.has(prop.key))
        return this.error(prop.key, 'Duplicate key in `state` object');

      this.state.define(prop.key, prop.type, prop.args);
    });

    // TODO(indutny): error on duplicate `state` definition
  }

  parseSettings(node) {
    const props = this.parseConfigObject(node, SETTINGS_TYPES);

    props.forEach((prop) => {
      if (this.settings.has(prop.key))
        return this.error(prop.key, 'Duplicate key in `settings` object');

      this.settings.define(prop.key, prop.type, prop.args);
    });

    // TODO(indutny): error on duplicate `settings` definition
  }

  buildCode() {
    this.globals.forEach((value, key) => {
      if (!(value instanceof dsl.ir.Code))
        return;

      value.build(this.builder);
      this.code.set(key, value);
    });
  }

  serialize() {
    let out = '';

    out += this.state.serialize();
    out += '\n';
    out += this.settings.serialize();
    out += '\n';

    this.code.forEach((code) => {
      out += code.serialize(this.reporter) + '\n';
    });

    return out;
  }
}
module.exports = Compiler;
