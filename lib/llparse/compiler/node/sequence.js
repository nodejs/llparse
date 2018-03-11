'use strict';

const llparse = require('../../');
const constants = llparse.constants;

const node = require('./');

const SEQUENCE_COMPLETE = constants.SEQUENCE_COMPLETE;
const SEQUENCE_PAUSE = constants.SEQUENCE_PAUSE;
const SEQUENCE_MISMATCH = constants.SEQUENCE_MISMATCH;

class Sequence extends node.Node {
  constructor(id, select) {
    super('sequence', id);

    this.select = select;
    this.next = null;
    this.value = null;
  }

  getChildren() {
    return super.getChildren().concat({
      node: this.next,
      noAdvance: false,
      key: this.select
    });
  }

  doBuild(ctx, body) {
    const INT = ctx.INT;

    const seq = ctx.blob(this.select);

    const cast = body.getelementptr(seq, INT.val(0), INT.val(0), true);

    const matchSequence = ctx.compilation.stageResults['match-sequence']
      .get(this.transform);

    const returnType = matchSequence.ty.toSignature().returnType;

    const call = body.call(matchSequence, [
      ctx.state,
      ctx.pos.current,
      ctx.endPos,
      cast,
      INT.val(seq.ty.toPointer().to.length)
    ]);

    const status = body.extractvalue(call,
      returnType.lookupField('status').index);
    const current = body.extractvalue(call,
      returnType.lookupField('current').index);

    // This is lame, but it is easier to do it this way
    // (Optimizer will remove it, if it isn't needed)
    const next = body.getelementptr(current, INT.val(1));

    const s = ctx.buildSwitch(body, status, [
      SEQUENCE_COMPLETE,
      SEQUENCE_PAUSE,
      SEQUENCE_MISMATCH
    ], [
      'unlikely', // default

      'likely',
      'unlikely', // pause
      this.otherwise instanceof node.Error ? 'unlikely' : 'likely'
    ]);

    // No other values are allowed
    s.otherwise.unreachable();

    const complete = s.cases[0];
    const pause = s.cases[1];
    const mismatch = s.cases[2];
    complete.name = 'complete';
    pause.name = 'pause';
    mismatch.name = 'mismatch';

    this.tailTo(ctx, complete, next, this.next, this.value);
    this.pause(ctx, pause);

    // Not equal
    this.doOtherwise(ctx, mismatch, { current, next });
  }
}
module.exports = Sequence;
