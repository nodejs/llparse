'use strict';

const assert = require('assert');
const esprima = require('esprima');

const types = require('./types');
const State = require('./state');
const Settings = require('./settings');

const STATE_TYPES = types.STATE_TYPES;
const SETTINGS_TYPES = types.SETTINGS_TYPES;

class Compiler {
  constructor(prefix, source) {
    this.prefix = prefix;
    this.source = source;

    this.ast = null;
    this.globals = null;
    this.state = new State();
    this.settings = new Settings();
  }

  compile() {
    this.ast = esprima.parse(this.source, { loc: true });
    assert.equal(this.ast.type, 'Program');

    this.globals = this.parseGlobals(this.ast.body);
    this.parseState();
    this.parseSettings();

    this.compileStates();

    let out = '';

    out += this.state.serialize();
    out += '\n';
    out += this.settings.serialize();
    out += '\n';

    return out;
  }

  error(node, string) {
    if (!node || !node.loc || !node.loc.start)
      throw new Error(string + ' at unknown position');

    const start = node.loc.start;
    const err = new Error(string + ` at ${start.line}:${start.column}`);
    err.node = node;
    throw err;
  }

  parseGlobals(body) {
    const globals = new Map();

    const declaration = (decl) => {
      if (globals.has(decl.id.name))
        this.error(decl.id, `Duplicate definition of ${decl.id.name}`);

      if (!decl.init)
        this.error(decl, `Missing init value for ${decl.id.name}`);

      globals.set(decl.id.name, decl.init);
    };

    body.forEach((node) => {
      if (node.type !== 'VariableDeclaration')
        return;

      node.declarations.forEach(declaration);
    });

    return globals;
  }

  parseConfigObject(node, types) {
    if (node.type !== 'ObjectExpression') {
      this.error(node,
        'Invalid configuration value type, must be ObjectExpression');
    }

    const result = [];
    node.properties.forEach((prop) => {
      if (prop.computed)
        this.error(prop, 'Configuration properties can\'t be computed');

      if (prop.key.type !== 'Identifier') {
        this.error(prop.key,
          'Configuration property keys must be Identifiers');
      }

      if (prop.value.type !== 'CallExpression') {
        this.error(prop.key,
          'Configuration property values must be CallExpressions');
      }

      const key = prop.key.name;

      if (prop.value.callee.type !== 'Identifier')
        this.error(value.callee, 'Unknown configuration property type');

      const type = prop.value.callee.name;
      const args = prop.value.arguments.map((arg) => {
        if (arg.type !== 'Literal')
          this.error(args, 'Invalid argument type, must be Literal');

        return arg.value;
      });

      if (!types.hasOwnProperty(type))
        this.error(value.callee, 'Unknown `state` property type');

      const validation = types[type](args);
      if (validation !== true) {
        this.error(value.callee,
          `Invalid arguments for "${type}": ${validation}`);
      }

      result.push({ key, type, args });
    });
    return result;
  }

  parseState() {
    assert(this.globals.has('state'), 'Missing `state` global object');

    const props = this.parseConfigObject(
      this.globals.get('state'), STATE_TYPES);

    props.forEach((prop) => {
      if (this.state.has(prop.key))
        this.error(prop.key, 'Duplicate key in `state` object');

      this.state.define(prop.key, prop.type, prop.args);
    });
  }

  parseSettings() {
    assert(this.globals.has('settings'), 'Missing `settings` global object');

    const props = this.parseConfigObject(
      this.globals.get('settings'), SETTINGS_TYPES);

    props.forEach((prop) => {
      if (this.settings.has(prop.key))
        this.error(prop.key, 'Duplicate key in `settings` object');

      this.settings.define(prop.key, prop.type, prop.args);
    });
  }

  compileStates() {
  }
}
module.exports = Compiler;
