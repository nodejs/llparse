'use strict';

const path = require('path');

const Fixture = require('llparse-test-fixture');

const fixtures = Fixture.create({
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

exports.NUM = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
};

exports.ERROR_PAUSE = Fixture.ERROR_PAUSE;

// Reasonable timeout for CI
exports.TIMEOUT = 10000;
