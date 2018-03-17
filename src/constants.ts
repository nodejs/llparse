import { Builder as IR, builder as ir } from 'bitcode';

import Type = ir.types.Type;

export type AttributeList = ReadonlyArray<ir.Attribute>;

export const I8 = IR.i(8);
export const I16 = IR.i(16);
export const I32 = IR.i(32);
export const I64 = IR.i(64);

export const BOOL = IR.i(1);
export const INT = I32;
export const INTPTR = I64; // TODO(indutny): find a way to do it cross-platform
export const CSTR = IR.i(8).ptr();
export const PTR = IR.i(8).ptr();
export const GEP_OFF = INT;
export const BRANCH_WEIGHT = INT;

export const CCONV: ir.CallingConv = 'fastcc';
export const LINKAGE: ir.Linkage = 'internal';

// Arguments

export const TYPE_OUTPUT = PTR;
export const TYPE_POS = CSTR;
export const TYPE_ENDPOS = TYPE_POS;
export const TYPE_MATCH = INT;

export const ARG_STATE = 'state';
export const ARG_POS = 'pos';
export const ARG_ENDPOS = 'endpos';
export const ARG_MATCH = 'match';

export const ATTR_STATE: AttributeList = [ 'noalias', 'nonnull' ];
export const ATTR_POS: AttributeList = [ 'noalias', 'nonnull', 'readonly' ];
export const ATTR_ENDPOS: AttributeList = [ 'noalias', 'nonnull', 'readnone' ];
export const ATTR_MATCH: AttributeList = [];

export const FN_ATTR_NODE: AttributeList = [
  // TODO(indutny): reassess `minsize`. Looks like it gives best performance
  // results right now, though.
  'nounwind', 'minsize', 'ssp', 'uwtable',
];
export const FN_ATTR_CODE: AttributeList = [
  'nounwind', 'norecurse', 'ssp', 'uwtable',
];
export const FN_ATTR_CODE_EXTERNAL: AttributeList = [ 'alwaysinline' ];

// State

export const TYPE_INDEX = INT;
export const TYPE_ERROR = INT;
export const TYPE_REASON = CSTR;
export const TYPE_ERROR_POS = TYPE_POS;
export const TYPE_DATA = PTR;
export const TYPE_SPAN_POS = TYPE_POS;

export const STATE_INDEX = '_index';
export const STATE_CURRENT = '_current';
export const STATE_ERROR = 'error';
export const STATE_REASON = 'reason';
export const STATE_ERROR_POS = 'error_pos';
export const STATE_DATA = 'data';

export const STATE_SPAN_POS = '_span_pos';
export const STATE_SPAN_CB = '_span_cb';

// Translator

// Minimum number of cases of `single` node to make it eligable for
// `TableLookup` optimization
export const DEFAULT_TRANSLATOR_MIN_TABLE_SIZE = 32;

// Maximum width of entry in a table for a `TableLookup` optimization
export const DEFAULT_TRANSLATOR_MAX_TABLE_WIDTH = 4;

// Sequence Matcher

export const TYPE_SEQUENCE = TYPE_POS;
export const TYPE_SEQUENCE_LEN = TYPE_INDEX;
export const TYPE_STATUS = INT;

export const ARG_SEQUENCE = 'seq';
export const ARG_SEQUENCE_LEN = 'seq_len';

export const SEQUENCE_COMPLETE = 0;
export const SEQUENCE_PAUSE = 1;
export const SEQUENCE_MISMATCH = 2;

export const ATTR_SEQUENCE = ATTR_POS;
export const ATTR_SEQUENCE_LEN: AttributeList = [];

export const FN_ATTR_MATCH_SEQUENCE: AttributeList = [
  'nounwind', 'norecurse', 'alwaysinline',
];
