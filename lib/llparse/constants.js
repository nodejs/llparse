'use strict';

const IR = require('llvm-ir');

exports.CCONV = 'fastcc';

exports.BOOL = IR.i(1);
exports.INT = IR.i(32);
exports.TYPE_INPUT = IR.i(8).ptr();
exports.TYPE_OUTPUT = IR.i(8).ptr();
exports.TYPE_MATCH = exports.INT;
exports.TYPE_INDEX = exports.INT;
exports.TYPE_ERROR = exports.INT;
exports.TYPE_REASON = IR.i(8).ptr();

exports.ARG_STATE = 's';
exports.ARG_POS = 'p';
exports.ARG_ENDPOS = 'endp';
