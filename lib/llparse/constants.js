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
exports.ARG_SEQUENCE = 'seq';
exports.ARG_SEQUENCE_LEN = 'slen';

exports.ATTR_STATE = 'noalias nocapture nonnull';
exports.ATTR_POS = 'noalias nocapture nonnull readonly';
exports.ATTR_ENDPOS = 'noalias nocapture nonnull readnone';
exports.ATTR_SEQUENCE = exports.ATTR_POS;

exports.SEQUENCE_COMPLETE = 0;
exports.SEQUENCE_PAUSE = 1;
exports.SEQUENCE_MISMATCH = 2;
