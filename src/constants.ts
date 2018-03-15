import { Builder as IR, builder as ir } from 'bitcode';

import Type = ir.types.Type;

export const I8 = IR.i(8);
export const I16 = IR.i(16);
export const I32 = IR.i(32);
export const I64 = IR.i(64);

export const BOOL = IR.i(1);
export const INT = I32;
export const CSTR = IR.i(8).ptr();
export const PTR = IR.i(8).ptr();
export const GEP_OFF = INT;

// Arguments

export const TYPE_OUTPUT = PTR;
export const TYPE_POS = CSTR;
export const TYPE_ENDPOS = TYPE_POS;
export const TYPE_MATCH = INT;

export const ARG_STATE = 'state';
export const ARG_POS = 'pos';
export const ARG_ENDPOS = 'endpos';
export const ARG_MATCH = 'match';

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
