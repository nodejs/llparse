export default (binding, inBench) => {
  const nop = () => 0;

  binding.llparse__print_zero = inBench ? nop : (p, buf, off) => {
    binding.llparse__print(buf, off, '0');
    return 0;
  };

  binding.llparse__print_one = inBench ? nop : (p, buf, off) => {
    binding.llparse__print(buf, off, '1');
    return 0;
  };

  binding.llparse__print_off = inBench ? nop : (p, buf, off) => {
    binding.llparse__print(buf, off, '');
    return 0;
  };

  binding.llparse__print_match = inBench ? nop : (p, buf, off, value) => {
    binding.llparse__print(buf, off, 'match=%d', value);
    return 0;
  };

  binding.llparse__on_dot = inBench ? nop : (p, buf, off, offLen) => {
    return binding.llparse__print_span('dot', buf, off, offLen);
  };

  binding.llparse__on_dash = inBench ? nop : (p, buf, off, offLen) => {
    return binding.llparse__print_span('dash', buf, off, offLen);
  };

  binding.llparse__on_underscore = inBench ? nop : (p, buf, off, offLen) => {
    return binding.llparse__print_span('underscore', buf, off, offLen);
  };

  /* A span callback, really */
  binding.llparse__please_fail = (p) => {
    p.reason = 'please fail';
    return 1;
  };

  /* A span callback, really */
  let onceCounter = 0;

  binding.llparse__pause_once = (p, buf, off, offLen) => {
    if (!inBench) {
      binding.llparse__print_span('pause', buf, off, offLen);
    }

    if (onceCounter !== 0) {
      return 0;
    }

    onceCounter++;
    return binding.LLPARSE__ERROR_PAUSE;
  };
};
