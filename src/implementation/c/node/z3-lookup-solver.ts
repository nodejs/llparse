const z3 = require('z3-solver');
import { runAsWorker } from 'synckit'

runAsWorker(async (byte_lookup_table: Array<number>) => {
  const { Context } = await z3.init();
  const { BitVec, Solver, Int, Array, Select } = new Context('main');
  
  const tlo = Array.const('TLO', Int.sort(), BitVec.sort(8));
  const thi = Array.const('THI', Int.sort(), BitVec.sort(8));
  const lut = Array.const('LUT', Int.sort(), BitVec.sort(8));

  const solver = new Solver();

  for (let i = 0; i < 256; i++) {
    if (byte_lookup_table[i] > 0) {
      solver.add(Select(lut, i).neq(BitVec.val(0, 8)));
    } else {
      solver.add(Select(lut, i).eq(BitVec.val(0, 8)));
    }

    solver.add(Select(tlo, i & 0xf).and(Select(thi, i >> 4)).eq(Select(lut, i)));
  }

  const solved = await solver.check();
  if (solved === 'unsat') {
    return null;
  }

  const model = await solver.model();
    
  let aa = [];
  let bb = [];

  for (let i = 0; i < 16; i++) {
    aa.push(Number(model.eval(Select(tlo, i)).value()));
    bb.push(Number(model.eval(Select(thi, i)).value()));
  }

  return [ aa, bb];
})