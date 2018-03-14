import { Attribute, Builder as IR, CallingConv } from 'bitcode';

export const CCONV: CallingConv = 'fastcc';

export const BOOL = IR.i(1);
export const INT = IR.i(32);
export const TYPE_INPUT = IR.i(8).ptr();
export const TYPE_OUTPUT = IR.i(8).ptr();
export const TYPE_MATCH = export const INT;
export const TYPE_INDEX = IR.i(64);
export const TYPE_ERROR = export const INT;
export const TYPE_REASON = IR.i(8).ptr();
export const TYPE_DATA = IR.i(8).ptr();
export const TYPE_STATUS = IR.i(32);

// TODO(indutny): although it works through zero extension, is there any
// cross-platform way to do it?
export const TYPE_INTPTR = IR.i(64);

export const ARG_STATE = 's';
export const ARG_POS = 'p';
export const ARG_ENDPOS = 'endp';
export const ARG_SEQUENCE = 'seq';
export const ARG_SEQUENCE_LEN = 'slen';
export const ARG_MATCH = 'match';
export const ARG_UNUSED = '_unused';

export const ATTR_STATE: ReadonlyArray<Attribute> = [ 'noalias', 'nonnull' ];
export const ATTR_POS: ReadonlyArray<Attribute> = [
  noalias', 'nonnull', 'readonly',
];
export const ATTR_ENDPOS: ReadonlyArray<Attribute> = [
  'noalias', 'nonnull', 'readnone',
];
export const ATTR_SEQUENCE = ATTR_POS;

export const SEQUENCE_COMPLETE = 0;
export const SEQUENCE_PAUSE = 1;
export const SEQUENCE_MISMATCH = 2;

// NOTE: It is important to start them with `_`, see `lib/llparse.js` (property)
export const SPAN_START_PREFIX = '_span_start';
export const SPAN_CB_PREFIX = '_span_cb';

export const DEFAULT_TRANSLATOR_MIN_CHECK_SIZE = 32;
export const DEFAULT_TRANSLATOR_MAX_CHECK_WIDTH = 4;

export const USER_TYPES = {
  i8: IR.i(8),
  i16: IR.i(16),
  i32: IR.i(32),
  i64: IR.i(64),
  ptr: IR.i(8).ptr(),
};
