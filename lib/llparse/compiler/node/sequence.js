'use strict';

const llparse = require('../../');
const constants = llparse.constants;

const node = require('./');

const SEQUENCE_COMPLETE = constants.SEQUENCE_COMPLETE;
const SEQUENCE_PAUSE = constants.SEQUENCE_PAUSE;
const SEQUENCE_MISMATCH = constants.SEQUENCE_MISMATCH;

class Sequence extends node.Node {
  constructor(name, select) {
    super('sequence', name);

    this.select = select;
    this.next = null;
    this.value = null;
  }

  doBuild(ctx, body, nodes) {
    const INT = ctx.INT;

    body.comment(`node.Sequence["${this.select.toString('hex') }"]`);

    const seq = ctx.ir.data(this.select);

    const cast = ctx.ir._('getelementptr inbounds', seq.type.to,
      [ seq.type, seq ], [ INT, INT.v(0) ], [ INT, INT.v(0) ]);
    body.push(cast);

    const matchSequence = ctx.compilation.stageResults['match-sequence'];

    const returnType = matchSequence.type.ret;

    const call = ctx.call('', matchSequence.type, matchSequence, [
      ctx.state,
      ctx.pos.current,
      ctx.endPos,
      cast,
      INT.v(seq.type.to.length)
    ]);
    body.push(call);

    const status = ctx.ir._('extractvalue', [ returnType, call ],
      INT.v(returnType.lookup('status')));
    body.push(status);

    const current = ctx.ir._('extractvalue', [ returnType, call ],
      INT.v(returnType.lookup('current')));
    body.push(current);

    // This is lame, but it is easier to do it this way
    // (Optimizer will remove it, if it isn't needed)
    body.comment('next = pos + 1');
    const next = ctx.ir._('getelementptr', ctx.pos.current.type.to,
      [ ctx.pos.current.type, current ], [ INT, INT.v(1) ]);
    body.push(next);

    const s = ctx.buildSwitch(body, INT, status, [
      SEQUENCE_COMPLETE,
      SEQUENCE_PAUSE,
      SEQUENCE_MISMATCH
    ]);

    // No other values are allowed
    s.otherwise.terminate('unreachable');

    const complete = s.cases[0];
    const pause = s.cases[1];
    const mismatch = s.cases[2];

    this.tailTo(ctx, complete, next,
      this.next.build(ctx.compilation, nodes), this.value);
    this.pause(ctx, pause);

    // Not equal
    this.doOtherwise(ctx, nodes, mismatch, { current, next });
  }
}
module.exports = Sequence;
