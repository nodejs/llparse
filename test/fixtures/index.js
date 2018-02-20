'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const spawn = require('child_process').spawn;
const spawnSync = require('child_process').spawnSync;
const Buffer = require('buffer').Buffer;

const async = require('async');

const CLANG = process.env.CLANG || 'clang';

const MAIN = path.join(__dirname, 'main.c');
const TMP_DIR = path.join(__dirname, '..', 'tmp');

const MAX_PARALLEL = 8;

exports.build = (name, source) => {
  try {
    fs.mkdirSync(TMP_DIR);
  } catch (e) {
    // no-op
  }

  const file = path.join(TMP_DIR, name + '.ll');
  const out = path.join(TMP_DIR, name);
  fs.writeFileSync(file, source);

  const ret = spawnSync(CLANG,
    [ '-Os', '-fvisibility=hidden', MAIN, file, '-o', out ]);
  if (ret.status !== 0) {
    process.stderr.write(ret.stdout);
    process.stderr.write(ret.stderr);
    throw new Error('clang exit code: ' + ret.status);
  }

  return (input, expected, callback) => {
    const buf = Buffer.from(input);
    async.timesLimit(buf.length, MAX_PARALLEL, (i, callback) => {
      const proc = spawn(out, [ i + 1, buf ], {
        stdio: [ null, 'pipe', 'inherit' ]
      });

      let stdout = '';
      proc.stdout.on('data', chunk => stdout += chunk);

      async.parallel({
        exit: cb => proc.once('exit', (code) => cb(null, code)),
        end: cb => proc.stdout.once('end', () => cb(null))
      }, (err, data) => {
        if (data.exit !== 0)
          return callback(new Error('Exit code: ' + data.exit));

        callback(null, stdout);
      });
    }, (err, results) => {
      if (err)
        return callback(err);

      for (let i = 0; i < results.length; i++)
        assert.strictEqual(results[i], expected, 'Scan value: ' + (i + 1));

      return callback(null);
    });
  };
};

exports.printMatch = (p, next) => {
  const code = p.code.value('print_match');

  return p.invoke(code, {
    0: next
  }, p.error(1, '`print_match` error'));
};

exports.printOff = (p, next) => {
  const code = p.code.match('print_off');

  return p.invoke(code, {
    0: next
  }, p.error(1, '`print_off` error'));
};

exports.compiledPrint = (p, next) => {
  const code = p.code.value('compiled_print_off', (ir, context) => {
    const INT = ir.i(32);
    const CSTR = ir.i(8).ptr();

    const body = context.fn.body;

    const puts = ir.declare(ir.signature(INT, [ CSTR ]), 'puts');

    const one = ir.cstr('one');
    const notOne = ir.cstr('not one');

    const castOne = ir._('getelementptr', one.type.to, [ one.type, one ],
      [ INT, INT.v(0) ], [ INT, INT.v(0) ]);
    const castNotOne = ir._('getelementptr', notOne.type.to,
      [ notOne.type, notOne ], [ INT, INT.v(0) ], [ INT, INT.v(0) ]);
    body.push(castOne);
    body.push(castNotOne);

    const cmp = ir._('icmp', [ 'eq', context.match.type, context.match ],
      context.match.type.v(1));
    body.push(cmp);

    const select = ir._('select', [ ir.i(1), cmp ], [ CSTR, castOne ],
      [ CSTR, castNotOne ]);
    body.push(select);

    body.push(ir._('call', [ puts.type.ret, puts, '(',
      CSTR, select, ')' ]));

    body.terminate('ret', [ context.ret, context.ret.v(0) ]);
  });

  return p.invoke(code, {
    0: next
  }, p.error(1, '`print_off` error'));
};
