'use strict';

const path = require('path');

const fixtures = require('llparse-test-fixture').create({
  buildDir: path.join(__dirname, '..', 'tmp'),
  extra: [ path.join(__dirname, 'extra.c') ]
});

exports.build = (...args) => fixtures.build(...args);

exports.printMatch = (p, next) => {
  const code = p.code.value('llparse__print_match');

  return p.invoke(code, next);
};

exports.printOff = (p, next) => {
  const code = p.code.match('llparse__print_off');

  return p.invoke(code, next);
};
