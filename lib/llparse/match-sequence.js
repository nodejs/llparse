'use strict';

const IR = require('llvm-ir');

const llparse = require('./');
const constants = llparse.constants;

const CCONV = constants.CCONV;

const BOOL = constants.BOOL;
const INT = constants.INT;
const TYPE_INPUT = constants.TYPE_INPUT;
const TYPE_INDEX = constants.TYPE_INDEX;

const ATTR_STATE = constants.ATTR_STATE;
const ATTR_POS = constants.ATTR_POS;
const ATTR_ENDPOS = constants.ATTR_ENDPOS;
const ATTR_SEQUENCE = constants.ATTR_SEQUENCE;

const ARG_STATE = constants.ARG_STATE;
const ARG_POS = constants.ARG_POS;
const ARG_ENDPOS = constants.ARG_ENDPOS;
const ARG_SEQUENCE = constants.ARG_SEQUENCE;
const ARG_SEQUENCE_LEN = constants.ARG_SEQUENCE_LEN;

const SEQUENCE_COMPLETE = constants.SEQUENCE_COMPLETE;
const SEQUENCE_PAUSE = constants.SEQUENCE_PAUSE;
const SEQUENCE_MISMATCH = constants.SEQUENCE_MISMATCH;

class MatchSequence {
  constructor(prefix, ir, state) {
    this.state = state;
    this.prefix = prefix;
    this.ir = ir;

    this.returnType = this.ir.struct('match_sequence_ret');

    this.returnType.field(TYPE_INPUT, 'current');
    this.returnType.field(INT, 'status');

    this.signature = IR.signature(this.returnType, [
      [ state.ptr(), ATTR_STATE ],
      [ TYPE_INPUT, ATTR_POS ],
      [ TYPE_INPUT, ATTR_ENDPOS ],
      [ TYPE_INPUT, ATTR_SEQUENCE ],
      INT
    ]);
  }

  build() {
    const fn = this.ir.fn(this.signature, `${this.prefix}__match_sequence`,
      [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_SEQUENCE, ARG_SEQUENCE_LEN ]);

    this.buildBody(fn);

    fn.visibility = 'internal';
    fn.cconv = CCONV;
    fn.attributes = 'nounwind norecurse';

    return fn;
  }

  buildBody(fn) {
    const body = fn.body;

    // Just to have a label
    const start = body.jump('br');
    start.name = 'start';

    // Load `state.index`
    start.comment('index = state.index');
    const indexPtr = this.index(fn);
    start.push(indexPtr);
    const index = IR._('load', TYPE_INDEX, [ TYPE_INDEX.ptr(), indexPtr ]);
    start.push(index);

    const loop = start.jump('br');
    loop.name = 'loop';

    // Loop start
    const posPhi = IR._('phi',
      [ TYPE_INPUT, '[', fn.arg(ARG_POS), ',', start.ref(), ']' ]);
    loop.push(posPhi);
    const indexPhi = IR._('phi',
      [ TYPE_INDEX, '[', index, ',', start.ref(), ']' ]);
    loop.push(indexPhi);

    const iteration = this.buildIteration(fn, loop, indexPtr, posPhi, indexPhi);

    // It is complete!
    this.ret(iteration.complete, iteration.pos, SEQUENCE_COMPLETE);

    // We have more data!
    iteration.loop.loop('br', loop);
    indexPhi.append([ '[', iteration.index, ',', iteration.loop.ref(), ']' ]);
    posPhi.append([ '[', iteration.pos.next, ',', iteration.loop.ref(), ']' ]);

    // Have to pause - return self
    this.ret(iteration.pause, iteration.pos, SEQUENCE_PAUSE);

    // Not equal
    this.ret(iteration.mismatch, iteration.pos, SEQUENCE_MISMATCH);
  }


  buildIteration(fn, body, indexField, pos, index) {
    const seq = fn.arg(ARG_SEQUENCE);
    const seqLen = fn.arg(ARG_SEQUENCE_LEN);

    body.comment('current = *pos');
    const current = IR._('load', TYPE_INPUT.to, [ TYPE_INPUT, pos ]);
    body.push(current);

    body.comment('expected = seq[state.index]');
    const expectedPtr = IR._('getelementptr', seq.type.to,
      [ seq.type, seq ],
      [ INT, index ]);
    body.push(expectedPtr);
    const expected = IR._('load', TYPE_INPUT.to, [ TYPE_INPUT, expectedPtr ]);
    body.push(expected);

    // NOTE: fetch this early so it would dominate all returns
    body.comment('next = pos + 1');
    const next = IR._('getelementptr', TYPE_INPUT.to,
      [ TYPE_INPUT, pos ],
      [ INT, INT.v(1) ]);
    body.push(next);

    body.comment('if (current == expected)');
    let cmp = IR._('icmp', [ 'eq', TYPE_INPUT.to, current ], expected);
    body.push(cmp);
    const { left: isMatch, right: isMismatch } =
      body.branch('br', [ BOOL, cmp ]);

    // Mismatch
    isMismatch.name = 'mismatch';
    isMismatch.comment('Sequence string does not match input');
    isMismatch.comment('state.index = 0');
    isMismatch.push(this.reset(indexField));

    // Character matches
    isMatch.name = 'match';
    isMatch.comment('Got a char match');

    isMatch.comment('index1 = index + 1');
    const index1 = IR._('add', [ TYPE_INDEX, index ], TYPE_INDEX.v(1));
    isMatch.push(index1);

    isMatch.comment('if (index1 == seq.length)');
    cmp = IR._('icmp', [ 'eq', TYPE_INDEX, index1 ], seqLen);
    isMatch.push(cmp);
    const { left: isComplete, right: isIncomplete } =
      isMatch.branch('br', [ BOOL, cmp ]);

    isComplete.name = 'is_complete';
    isComplete.comment('state.index = 0');
    isComplete.push(this.reset(indexField));

    isIncomplete.name = 'is_incomplete';
    isIncomplete.comment('if (next != endpos)');
    cmp = IR._('icmp', [ 'ne', TYPE_INPUT, next ], fn.arg(ARG_ENDPOS));
    isIncomplete.push(cmp);
    const { left: moreData, right: noMoreData } =
      isIncomplete.branch('br', [ BOOL, cmp ]);

    moreData.name = 'more_data';

    noMoreData.name = 'no_more_data';
    noMoreData.comment('state.index = index1');
    noMoreData.push(IR._('store', [ TYPE_INDEX, index1 ],
      [ TYPE_INDEX.ptr(), indexField ]).void());

    return {
      index: index1,
      pos: { current: pos, next },
      complete: isComplete,
      mismatch: isMismatch,
      loop: moreData,
      pause: noMoreData
    };
  }

  ret(body, pos, status) {
    const create = IR._('insertvalue', [ this.returnType, 'undef' ],
      [ TYPE_INPUT, pos.current ],
      INT.v(this.returnType.lookup('current')));
    body.push(create);

    const amend = IR._('insertvalue', [ this.returnType, create ],
      [ INT, INT.v(status) ],
      INT.v(this.returnType.lookup('status')));
    body.push(amend);

    body.terminate('ret', [ this.returnType, amend ]);
  }

  index(fn) {
    const stateArg = fn.arg(ARG_STATE);

    return IR._('getelementptr', this.state,
      [ stateArg.type, stateArg ],
      [ INT, INT.v(0) ],
      [ INT, INT.v(this.state.lookup('index')) ]);
  }

  reset(field) {
    return IR._('store', [ TYPE_INDEX, TYPE_INDEX.v(0) ],
      [ TYPE_INDEX.ptr(), field ]).void();
  }
}
module.exports = MatchSequence;
