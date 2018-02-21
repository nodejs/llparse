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

  return p.invoke(code, next);
};

exports.printOff = (p, next) => {
  const code = p.code.match('print_off');

  return p.invoke(code, next);
};
