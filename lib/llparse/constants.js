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
exports.TYPE_DATA = IR.i(8).ptr();

exports.ARG_STATE = 's';
exports.ARG_POS = 'p';
exports.ARG_ENDPOS = 'endp';
exports.ARG_SEQUENCE = 'seq';
exports.ARG_SEQUENCE_LEN = 'slen';
exports.ARG_MATCH = 'match';
exports.ARG_UNUSED = '_unused';

exports.ATTR_STATE = 'noalias nocapture nonnull';
exports.ATTR_POS = 'noalias nocapture nonnull readonly';
exports.ATTR_ENDPOS = 'noalias nocapture nonnull readnone';
exports.ATTR_SEQUENCE = exports.ATTR_POS;

exports.SEQUENCE_COMPLETE = 0;
exports.SEQUENCE_PAUSE = 1;
exports.SEQUENCE_MISMATCH = 2;

// NOTE: It is important to start them with `_`, see `lib/llparse.js` (property)
exports.SPAN_START_PREFIX = '_span_start';
exports.SPAN_CB_PREFIX = '_span_cb';

exports.USER_TYPES = {
  i8: IR.i(8),
  i16: IR.i(16),
  i32: IR.i(32),
  i64: IR.i(64),
  'ptr': IR.i(8).ptr()
};
