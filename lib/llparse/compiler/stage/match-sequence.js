'use strict';

const Stage = require('./').Stage;
const llparse = require('../../');
const constants = llparse.constants;

const CCONV = constants.CCONV;

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
    this.returnType.addField(TYPE_INPUT, 'current');
    this.returnType.addField(TYPE_STATUS, 'status');
    this.returnType.finalize();

    this.signature = this.ctx.ir.signature(this.returnType, [
      this.ctx.state.ptr(),
      TYPE_INPUT,
      TYPE_INPUT,
      TYPE_INPUT,
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

    const fn = this.ctx.defineFunction(this.signature,
      `${this.ctx.prefix}__match_sequence${postfix}`,
      [ ARG_STATE, ARG_POS, ARG_ENDPOS, ARG_SEQUENCE, ARG_SEQUENCE_LEN ]);

    fn.paramAttrs[0].add(ATTR_STATE);
    fn.paramAttrs[1].add(ATTR_POS);
    fn.paramAttrs[2].add(ATTR_ENDPOS);
    fn.paramAttrs[3].add(ATTR_SEQUENCE);

    this.buildBody(fn, transform);

    fn.linkage = 'internal';
    fn.cconv = CCONV;
    fn.attrs.add([ 'nounwind', 'norecurse', 'alwaysinline' ]);

    this.cache.set(cacheKey, fn);

    return fn;
  }

  // TODO(indutny): initialize `state.index` before calling matcher?
  buildBody(fn, transform) {
    const body = fn.body;

    const maxSeqLen = this.ctx.stageResults['node-translator'].maxSequenceLen;
    const range = this.ctx.ir.metadata([
      this.ctx.ir.metadata(TYPE_INDEX.val(0)),
      this.ctx.ir.metadata(TYPE_INDEX.val(maxSeqLen))
    ]);

    // Just to have a label
    const start = body.parent.createBlock('start');
    body.jmp(start);

    // Load `state.index`
    const indexPtr = this.ctx.stateField(fn, start, '_index');
    const index = start.load(indexPtr);
    index.metadata.set('invariant.group', this.ctx.INVARIANT_GROUP);
    index.metadata.set('range', range);

    // Loop start
    const loop = body.parent.createBlock('loop');
    start.jmp(loop);

    const posPhi = loop.phi({ fromBlock: start, value: this.ctx.posArg(fn) });
    const indexPhi = loop.phi({ fromBlock: start, value: index });

    const iteration = this.buildIteration(fn, loop, indexPtr, posPhi, indexPhi,
      transform);

    // It is complete!
    this.ret(iteration.complete, iteration.pos, SEQUENCE_COMPLETE);

    // We have more data!
    iteration.loop.jmp(loop);
    indexPhi.addEdge({ fromBlock: iteration.loop, value: iteration.index });
    posPhi.addEdge({ fromBlock: iteration.loop, value: iteration.pos.next });

    // Have to pause - return self
    this.ret(iteration.pause, iteration.pos, SEQUENCE_PAUSE);

    // Not equal
    this.ret(iteration.mismatch, iteration.pos, SEQUENCE_MISMATCH);
  }

  buildIteration(fn, body, indexField, pos, index, transform) {
    const seq = fn.getArgument(ARG_SEQUENCE);
    const seqLen = fn.getArgument(ARG_SEQUENCE_LEN);

    let current = body.load(pos);

    // Transform the character if needed
    if (transform) {
      const res  = this.ctx.buildTransform(transform,
        body, current);
      body = res.body;
      current = res.current;
    }

    const expectedPtr = body.getelementptr(seq, index);
    const expected = body.load(expectedPtr);

    // NOTE: fetch this early so it would dominate all returns
    const next = body.getelementptr(pos, INT.val(1));

    let cmp = body.icmp('eq', current, expected);
    const isMatch = fn.createBlock('match');
    const isMismatch = fn.createBlock('mismatch');
    body.branch(cmp, isMatch, isMismatch);

    // Mismatch
    this.reset(isMismatch, indexField);

    // Character matches
    const index1 = isMatch.binop('add', index, TYPE_INDEX.val(1));
    cmp = isMatch.icmp('eq', index1, seqLen);

    const isComplete = fn.createBlock('is_complete');
    const isIncomplete = fn.createBlock('is_incomplete');
    isMatch.branch(cmp, isComplete, isIncomplete);

    this.reset(isComplete, indexField);

    cmp = isIncomplete.icmp('ne', next, this.ctx.endPosArg(fn));
    const { left: moreData, right: noMoreData } =
      this.ctx.branch(isIncomplete, cmp, [ 'likely', 'unlikely' ]);

    moreData.name = 'more_data';

    noMoreData.name = 'no_more_data';
    const store = noMoreData.store(index1, indexField);
    store.metadata.set('invariant.group', this.ctx.INVARIANT_GROUP);

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
    const create = body.insertvalue(this.returnType.undef(), pos.current,
      this.returnType.lookupField('current').index);

    const amend = body.insertvalue(create, TYPE_STATUS.val(status),
      this.returnType.lookupField('status').index);

    body.ret(amend);
  }

  reset(body, field) {
    const store = body.store(TYPE_INDEX.val(0), field);
    store.metadata.set('invariant.group', this.ctx.INVARIANT_GROUP);
    return store;
  }
}
module.exports = MatchSequence;
