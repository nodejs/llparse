'use strict';

const Stage = require('./').Stage;
const llparse = require('../../');
const constants = llparse.constants;

const CCONV = constants.CCONV;

const BOOL = constants.BOOL;
const INT = constants.INT;
const TYPE_INPUT = constants.TYPE_INPUT;
const TYPE_INDEX = constants.TYPE_INDEX;
const TYPE_STATUS = constants.TYPE_STATUS;

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

class MatchSequence extends Stage {
  constructor(ctx) {
    super(ctx, 'match-sequence');

    this.returnType = this.ctx.ir.struct('match_sequence_ret');

    this.returnType.field(TYPE_INPUT, 'current');
    this.returnType.field(TYPE_STATUS, 'status');

    this.signature = this.ctx.ir.signature(this.returnType, [
      [ this.ctx.state.ptr(), ATTR_STATE ],
      [ TYPE_INPUT, ATTR_POS ],
      [ TYPE_INPUT, ATTR_ENDPOS ],
      [ TYPE_INPUT, ATTR_SEQUENCE ],
      INT
    ]);

    this.cache = new Map();
  }

  build() {
    return {
      get: transform => this.get(transform)
    };
  }

  get(transform = null) {
    const cacheKey = transform === null ? null : transform.name;
    if (this.cache.has(cacheKey))
      return this.cache.get(cacheKey);

    const postfix = cacheKey ? '_' + cacheKey.toLowerCase() : '';

    const fn = this.ctx.ir.fn(this.signature,
      `${this.ctx.prefix}__match_sequence${postfix}`,
      [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_SEQUENCE, ARG_SEQUENCE_LEN ]);

    this.buildBody(fn, transform);

    fn.visibility = 'internal';
    fn.cconv = CCONV;
    fn.attributes = 'nounwind norecurse alwaysinline';

    this.cache.set(cacheKey, fn);

    return fn;
  }

  // TODO(indutny): initialize `state.index` before calling matcher?
  buildBody(fn, transform) {
    const body = fn.body;
    const ir = this.ctx.ir;

    const maxSeqLen = this.ctx.stageResults['node-translator'].maxSequenceLen;
    const range = `${TYPE_INDEX.type} 0, ${TYPE_INDEX.type} ${maxSeqLen}`;

    // Just to have a label
    const start = body.jump('br');
    start.name = 'start';

    // Load `state.index`
    start.comment('index = state.index');
    const indexPtr = this.ctx.field(fn, '_index');
    start.push(indexPtr);
    const index = ir._('load', TYPE_INDEX, [ TYPE_INDEX.ptr(), indexPtr ],
      [ '!invariant.group', this.ctx.INVARIANT_GROUP ],
      [ '!range', ir.metadata(range) ]);
    start.push(index);

    const loop = start.jump('br');
    loop.name = 'loop';

    // Loop start
    const posPhi = ir._('phi',
      [ TYPE_INPUT, '[', fn.arg(ARG_POS), ',', start.ref(), ']' ]);
    loop.push(posPhi);
    const indexPhi = ir._('phi',
      [ TYPE_INDEX, '[', index, ',', start.ref(), ']' ]);
    loop.push(indexPhi);

    const iteration = this.buildIteration(fn, loop, indexPtr, posPhi, indexPhi,
      transform);

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


  buildIteration(fn, body, indexField, pos, index, transform) {
    const ir = this.ctx.ir;

    const seq = fn.arg(ARG_SEQUENCE);
    const seqLen = fn.arg(ARG_SEQUENCE_LEN);

    body.comment('current = *pos');
    let current = ir._('load', TYPE_INPUT.to, [ TYPE_INPUT, pos ]);
    body.push(current);

    // Transform the character if needed
    if (transform) {
      const res  = this.ctx.buildTransform(transform,
        body, current);
      body = res.body;
      current = res.current;
    }

    body.comment('expected = seq[state.index]');
    const expectedPtr = ir._('getelementptr', seq.type.to,
      [ seq.type, seq ],
      [ INT, index ]);
    body.push(expectedPtr);
    const expected = ir._('load', TYPE_INPUT.to, [ TYPE_INPUT, expectedPtr ]);
    body.push(expected);

    // NOTE: fetch this early so it would dominate all returns
    body.comment('next = pos + 1');
    const next = ir._('getelementptr', TYPE_INPUT.to,
      [ TYPE_INPUT, pos ],
      [ INT, INT.v(1) ]);
    body.push(next);

    body.comment('if (current == expected)');
    let cmp = ir._('icmp', [ 'eq', TYPE_INPUT.to, current ], expected);
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
    const index1 = ir._('add', [ TYPE_INDEX, index ], TYPE_INDEX.v(1));
    isMatch.push(index1);

    isMatch.comment('if (index1 == seq.length)');
    cmp = ir._('icmp', [ 'eq', TYPE_INDEX, index1 ], seqLen);
    isMatch.push(cmp);
    const { left: isComplete, right: isIncomplete } =
      isMatch.branch('br', [ BOOL, cmp ]);

    isComplete.name = 'is_complete';
    isComplete.comment('state.index = 0');
    isComplete.push(this.reset(indexField));

    isIncomplete.name = 'is_incomplete';
    isIncomplete.comment('if (next != endpos)');
    cmp = ir._('icmp', [ 'ne', TYPE_INPUT, next ], fn.arg(ARG_ENDPOS));
    isIncomplete.push(cmp);
    const { left: moreData, right: noMoreData } =
      this.ctx.branch(isIncomplete, cmp, [ 'likely', 'unlikely' ]);

    moreData.name = 'more_data';

    noMoreData.name = 'no_more_data';
    noMoreData.comment('state.index = index1');
    noMoreData.push(ir._('store', [ TYPE_INDEX, index1 ],
      [ TYPE_INDEX.ptr(), indexField ],
      [ '!invariant.group', this.ctx.INVARIANT_GROUP ]).void());

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
    const ir = this.ctx.ir;

    const create = ir._('insertvalue', [ this.returnType, 'undef' ],
      [ TYPE_INPUT, pos.current ],
      INT.v(this.returnType.lookup('current')));
    body.push(create);

    const amend = ir._('insertvalue', [ this.returnType, create ],
      [ TYPE_STATUS, TYPE_STATUS.v(status) ],
      INT.v(this.returnType.lookup('status')));
    body.push(amend);

    body.terminate('ret', [ this.returnType, amend ]);
  }

  reset(field) {
    return this.ctx.ir._('store', [ TYPE_INDEX, TYPE_INDEX.v(0) ],
      [ TYPE_INDEX.ptr(), field ],
      [ '!invariant.group', this.ctx.INVARIANT_GROUP ]).void();
  }
}
module.exports = MatchSequence;
